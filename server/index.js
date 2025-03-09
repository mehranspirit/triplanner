require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Trip = require('./models/Trip');
const authRoutes = require('./routes/auth');
const auth = require('./middleware/auth');
const User = require('./models/User');

const app = express();

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN.split(',');
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());

// Mount auth routes
app.use('/api/auth', authRoutes);

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
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email')
      .lean()
      .exec();

    // Transform the response to ensure consistent _id usage
    const transformedTrips = trips.map(trip => ({
      ...trip,
      _id: trip._id.toString(),
      owner: {
        _id: trip.owner._id.toString(),
        name: trip.owner.name,
        email: trip.owner.email
      },
      collaborators: trip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email
        }
      }))
    }));

    console.log('Found trips:', {
      count: transformedTrips.length,
      tripIds: transformedTrips.map(t => t._id)
    });

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
      createdAt: populatedTrip.createdAt.toISOString(),
      updatedAt: populatedTrip.updatedAt.toISOString()
    };

    // Remove MongoDB-specific fields
    delete transformedTrip.__v;
    delete transformedTrip.id;
    delete transformedTrip.owner.id;
    
    console.log('Final transformed trip:', JSON.stringify(transformedTrip, null, 2));
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

    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email _id')
      .populate('collaborators.user', 'name email _id')
      .lean()
      .exec();
    
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

    // Transform the response to ensure consistent _id usage
    const transformedTrip = {
      ...trip,
      _id: trip._id.toString(),
      owner: {
        _id: trip.owner._id.toString(),
        name: trip.owner.name,
        email: trip.owner.email
      },
      collaborators: trip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email
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
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has edit access (owner or editor)
    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole || (accessRole === 'viewer')) {
      return res.status(403).json({ message: 'You do not have permission to edit this trip' });
    }

    // Preserve existing data that shouldn't be overwritten
    const updateData = {
      ...req.body,
      owner: trip.owner,  // Preserve the original owner
      collaborators: trip.collaborators  // Preserve existing collaborators
    };

    // Update the trip
    const updatedTrip = await Trip.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'name email')
     .populate('collaborators.user', 'name email');

    console.log('Trip updated:', {
      tripId: updatedTrip._id,
      events: updatedTrip.events.length,
      collaborators: updatedTrip.collaborators.length
    });

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
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
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
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');

    res.json(populatedTrip);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ message: error.message });
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 