require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Trip = require('./models/Trip');
const authRoutes = require('./routes/auth');
const auth = require('./middleware/auth');

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
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

// Protected Routes
app.get('/api/trips', auth, async (req, res) => {
  try {
    const trips = await Trip.find({ owner: req.user._id })
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/trips', auth, async (req, res) => {
  try {
    const trip = new Trip({
      ...req.body,
      owner: req.user._id
    });
    const savedTrip = await trip.save();
    await savedTrip.populate('owner', 'name email');
    res.status(201).json(savedTrip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/trips/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Check if user has access (owner, editor, or viewer)
    const accessRole = trip.hasAccess(req.user._id);
    if (!accessRole) {
      return res.status(403).json({ message: 'You do not have access to this trip' });
    }

    res.json(trip);
  } catch (error) {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 