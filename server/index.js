require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Trip = require('./models/Trip');
const authRoutes = require('./routes/auth');
const auth = require('./middleware/auth');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, uploadToS3, getS3Url, getKeyFromUrl } = require('./utils/s3Config');
const checkS3Connectivity = require('./utils/ensureUploadsDir');

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
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 