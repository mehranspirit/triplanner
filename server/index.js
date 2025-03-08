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
  credentials: true
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
    const trip = await Trip.findOne({ _id: req.params.id, owner: req.user._id })
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email');
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/trips/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      req.body,
      { new: true }
    ).populate('owner', 'name email')
     .populate('collaborators.user', 'name email');
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json(trip);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/trips/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json({ message: 'Trip deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 