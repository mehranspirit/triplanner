const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const DreamTrip = require('../models/DreamTrip');
const User = require('../models/User');
const { logActivity } = require('../utils/activityLogger');
const fetch = require('node-fetch');

// Get all dream trips for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const dreamTrips = await DreamTrip.find({
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    })
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    // Transform the response to ensure consistent _id usage
    const transformedTrips = dreamTrips.map(trip => ({
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

    res.json(transformedTrips);
  } catch (error) {
    console.error('Error fetching dream trips:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new dream trip
router.post('/', auth, async (req, res) => {
  try {
    const dreamTrip = new DreamTrip({
      ...req.body,
      owner: req.user._id,
      collaborators: [],
      ideas: [],
      isPublic: false,
      tags: req.body.tags || []
    });

    const savedTrip = await dreamTrip.save();

    // Populate the owner and collaborators
    const populatedTrip = await DreamTrip.findById(savedTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    // Transform the response
    const transformedTrip = {
      ...populatedTrip,
      _id: populatedTrip._id.toString(),
      owner: {
        _id: populatedTrip.owner._id.toString(),
        name: populatedTrip.owner.name,
        email: populatedTrip.owner.email,
        photoUrl: populatedTrip.owner.photoUrl || null
      },
      collaborators: populatedTrip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    };

    res.status(201).json(transformedTrip);
  } catch (error) {
    console.error('Error creating dream trip:', error);
    res.status(400).json({ message: error.message });
  }
});

// Get a specific dream trip
router.get('/:id', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if user has access
    const hasAccess = dreamTrip.owner._id.toString() === req.user._id.toString() ||
      dreamTrip.collaborators.some(c => c.user._id.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this dream trip' });
    }

    // Transform the response
    const transformedTrip = {
      ...dreamTrip,
      _id: dreamTrip._id.toString(),
      owner: {
        _id: dreamTrip.owner._id.toString(),
        name: dreamTrip.owner.name,
        email: dreamTrip.owner.email,
        photoUrl: dreamTrip.owner.photoUrl || null
      },
      collaborators: dreamTrip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    };

    res.json(transformedTrip);
  } catch (error) {
    console.error('Error fetching dream trip:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update a dream trip
router.put('/:id', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if user has access
    const hasAccess = dreamTrip.owner.toString() === req.user._id.toString() ||
      dreamTrip.collaborators.some(c => c.user.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this dream trip' });
    }

    // Update the dream trip
    Object.assign(dreamTrip, req.body);
    const updatedTrip = await dreamTrip.save();

    // Populate and transform the response
    const populatedTrip = await DreamTrip.findById(updatedTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    const transformedTrip = {
      ...populatedTrip,
      _id: populatedTrip._id.toString(),
      owner: {
        _id: populatedTrip.owner._id.toString(),
        name: populatedTrip.owner.name,
        email: populatedTrip.owner.email,
        photoUrl: populatedTrip.owner.photoUrl || null
      },
      collaborators: populatedTrip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    };

    res.json(transformedTrip);
  } catch (error) {
    console.error('Error updating dream trip:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete a dream trip
router.delete('/:id', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Only the owner can delete the dream trip
    if (dreamTrip.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete this dream trip' });
    }

    await dreamTrip.deleteOne();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting dream trip:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add an idea to a dream trip
router.post('/:id/ideas', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if user has access
    const hasAccess = dreamTrip.owner.toString() === req.user._id.toString() ||
      dreamTrip.collaborators.some(c => c.user.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this dream trip' });
    }

    // If no images provided, fetch from Pexels
    let images = req.body.images || [];
    if (images.length === 0) {
      try {
        const response = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(req.body.title)}&per_page=1&orientation=landscape`,
          {
            headers: {
              'Authorization': process.env.PEXELS_API_KEY
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.photos && data.photos.length > 0) {
            images = [{
              url: data.photos[0].src.large2x,
              caption: `Image for ${req.body.title}`
            }];
          }
        }
      } catch (error) {
        console.warn('Failed to fetch image from Pexels:', error);
      }
    }

    // Add the new idea
    const newIdea = {
      ...req.body,
      images,
      createdBy: req.user._id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    dreamTrip.ideas.push(newIdea);
    await dreamTrip.save();

    // Populate and transform the response
    const populatedTrip = await DreamTrip.findById(dreamTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .populate('ideas.createdBy', 'name email photoUrl')
      .lean()
      .exec();

    // Get the newly added idea
    const addedIdea = populatedTrip.ideas[populatedTrip.ideas.length - 1];

    // Transform the idea response
    const transformedIdea = {
      ...addedIdea,
      _id: addedIdea._id.toString(),
      createdBy: {
        _id: addedIdea.createdBy._id.toString(),
        name: addedIdea.createdBy.name,
        email: addedIdea.createdBy.email,
        photoUrl: addedIdea.createdBy.photoUrl || null
      }
    };

    res.status(201).json(transformedIdea);
  } catch (error) {
    console.error('Error adding idea:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update an idea in a dream trip
router.put('/:id/ideas/:ideaId', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if user has access
    const hasAccess = dreamTrip.owner.toString() === req.user._id.toString() ||
      dreamTrip.collaborators.some(c => c.user.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this dream trip' });
    }

    // Find the idea to update
    const ideaIndex = dreamTrip.ideas.findIndex(idea => idea._id.toString() === req.params.ideaId);
    if (ideaIndex === -1) {
      return res.status(404).json({ message: 'Idea not found' });
    }

    // If title is being updated and no images provided, fetch from Pexels
    let images = req.body.images || dreamTrip.ideas[ideaIndex].images;
    if (req.body.title && (!images || images.length === 0)) {
      try {
        const response = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(req.body.title)}&per_page=1&orientation=landscape`,
          {
            headers: {
              'Authorization': process.env.PEXELS_API_KEY
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.photos && data.photos.length > 0) {
            images = [{
              url: data.photos[0].src.large2x,
              caption: `Image for ${req.body.title}`
            }];
          }
        }
      } catch (error) {
        console.warn('Failed to fetch image from Pexels:', error);
      }
    }

    // Update the idea
    const updatedIdea = {
      ...dreamTrip.ideas[ideaIndex].toObject(),
      ...req.body,
      images,
      updatedAt: new Date()
    };

    dreamTrip.ideas[ideaIndex] = updatedIdea;
    await dreamTrip.save();

    // Populate and transform the response
    const populatedTrip = await DreamTrip.findById(dreamTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .populate('ideas.createdBy', 'name email photoUrl')
      .lean()
      .exec();

    // Get the updated idea
    const transformedIdea = {
      ...populatedTrip.ideas[ideaIndex],
      _id: populatedTrip.ideas[ideaIndex]._id.toString(),
      createdBy: {
        _id: populatedTrip.ideas[ideaIndex].createdBy._id.toString(),
        name: populatedTrip.ideas[ideaIndex].createdBy.name,
        email: populatedTrip.ideas[ideaIndex].createdBy.email,
        photoUrl: populatedTrip.ideas[ideaIndex].createdBy.photoUrl || null
      }
    };

    res.json(transformedIdea);
  } catch (error) {
    console.error('Error updating idea:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete an idea from a dream trip
router.delete('/:id/ideas/:ideaId', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if user has access
    const hasAccess = dreamTrip.owner.toString() === req.user._id.toString() ||
      dreamTrip.collaborators.some(c => c.user.toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ message: 'You do not have access to this dream trip' });
    }

    // Find and remove the idea
    const ideaIndex = dreamTrip.ideas.findIndex(idea => idea._id.toString() === req.params.ideaId);
    if (ideaIndex === -1) {
      return res.status(404).json({ message: 'Idea not found' });
    }

    dreamTrip.ideas.splice(ideaIndex, 1);
    await dreamTrip.save();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting idea:', error);
    res.status(400).json({ message: error.message });
  }
});

// Add a collaborator to a dream trip
router.post('/:id/collaborators', auth, async (req, res) => {
  try {
    const { email, role } = req.body;
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if the requester is the owner or an editor
    const isOwner = dreamTrip.owner.toString() === req.user._id.toString();
    const isEditor = dreamTrip.collaborators.some(
      c => c.user.toString() === req.user._id.toString() && c.role === 'editor'
    );

    if (!isOwner && !isEditor) {
      return res.status(403).json({ message: 'Only the owner or editors can add collaborators' });
    }

    // Find the user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already a collaborator
    const isAlreadyCollaborator = dreamTrip.collaborators.some(
      c => c.user.toString() === user._id.toString()
    );
    if (isAlreadyCollaborator) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    // Add the collaborator
    dreamTrip.collaborators.push({
      user: user._id,
      role: role || 'viewer',
      addedAt: new Date()
    });

    await dreamTrip.save();

    // Log the activity
    await logActivity({
      user: req.user._id,
      action: 'add_collaborator',
      entityType: 'dream_trip',
      entityId: dreamTrip._id,
      details: {
        collaboratorEmail: email,
        collaboratorName: user.name,
        role: role || 'viewer'
      }
    });

    // Populate and transform the response
    const populatedTrip = await DreamTrip.findById(dreamTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    const transformedTrip = {
      ...populatedTrip,
      _id: populatedTrip._id.toString(),
      owner: {
        _id: populatedTrip.owner._id.toString(),
        name: populatedTrip.owner.name,
        email: populatedTrip.owner.email,
        photoUrl: populatedTrip.owner.photoUrl || null
      },
      collaborators: populatedTrip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    };

    res.status(201).json(transformedTrip);
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(400).json({ message: error.message });
  }
});

// Delete a collaborator from a dream trip
router.delete('/:id/collaborators/:userId', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if the requester is the owner
    if (dreamTrip.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can remove collaborators' });
    }

    // Find the collaborator to remove
    const collaboratorIndex = dreamTrip.collaborators.findIndex(
      c => c.user.toString() === req.params.userId
    );

    if (collaboratorIndex === -1) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    // Get collaborator info for logging
    const collaborator = dreamTrip.collaborators[collaboratorIndex];
    const user = await User.findById(req.params.userId);

    // Remove the collaborator
    dreamTrip.collaborators.splice(collaboratorIndex, 1);
    await dreamTrip.save();

    // Log the activity
    await logActivity({
      user: req.user._id,
      action: 'remove_collaborator',
      entityType: 'dream_trip',
      entityId: dreamTrip._id,
      details: {
        collaboratorEmail: user.email,
        collaboratorName: user.name,
        role: collaborator.role
      }
    });

    // Populate and transform the response
    const populatedTrip = await DreamTrip.findById(dreamTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    const transformedTrip = {
      ...populatedTrip,
      _id: populatedTrip._id.toString(),
      owner: {
        _id: populatedTrip.owner._id.toString(),
        name: populatedTrip.owner.name,
        email: populatedTrip.owner.email,
        photoUrl: populatedTrip.owner.photoUrl || null
      },
      collaborators: populatedTrip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    };

    res.json(transformedTrip);
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(400).json({ message: error.message });
  }
});

// Update a collaborator's role (PUT method for client compatibility)
router.put('/:id/collaborators/:userId', auth, async (req, res) => {
  try {
    const { role } = req.body;
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check if the requester is the owner
    if (dreamTrip.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can update collaborator roles' });
    }

    // Find the collaborator to update
    const collaboratorIndex = dreamTrip.collaborators.findIndex(
      c => c.user.toString() === req.params.userId
    );

    if (collaboratorIndex === -1) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    // Get collaborator info for logging
    const oldRole = dreamTrip.collaborators[collaboratorIndex].role;
    const user = await User.findById(req.params.userId);

    // Update the role
    dreamTrip.collaborators[collaboratorIndex].role = role;
    await dreamTrip.save();

    // Log the activity
    await logActivity({
      user: req.user._id,
      action: 'update_collaborator_role',
      entityType: 'dream_trip',
      entityId: dreamTrip._id,
      details: {
        collaboratorEmail: user.email,
        collaboratorName: user.name,
        oldRole,
        newRole: role
      }
    });

    // Populate and transform the response
    const populatedTrip = await DreamTrip.findById(dreamTrip._id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    const transformedTrip = {
      ...populatedTrip,
      _id: populatedTrip._id.toString(),
      owner: {
        _id: populatedTrip.owner._id.toString(),
        name: populatedTrip.owner.name,
        email: populatedTrip.owner.email,
        photoUrl: populatedTrip.owner.photoUrl || null
      },
      collaborators: populatedTrip.collaborators.map(c => ({
        ...c,
        user: {
          _id: c.user._id.toString(),
          name: c.user.name,
          email: c.user.email,
          photoUrl: c.user.photoUrl || null
        }
      }))
    };

    res.json(transformedTrip);
  } catch (error) {
    console.error('Error updating collaborator role:', error);
    res.status(400).json({ message: error.message });
  }
});

// Leave a dream trip (self-removal)
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const dreamTrip = await DreamTrip.findById(req.params.id);

    if (!dreamTrip) {
      return res.status(404).json({ message: 'Dream trip not found' });
    }

    // Check that the user is not the owner
    if (dreamTrip.owner.toString() === req.user._id.toString()) {
      return res.status(403).json({ message: 'The owner cannot leave their own trip' });
    }

    // Find the user's collaborator entry
    const collaboratorIndex = dreamTrip.collaborators.findIndex(
      c => c.user.toString() === req.user._id.toString()
    );

    if (collaboratorIndex === -1) {
      return res.status(404).json({ message: 'You are not a collaborator on this trip' });
    }

    // Get collaborator info for logging
    const collaborator = dreamTrip.collaborators[collaboratorIndex];
    const user = await User.findById(req.user._id);

    // Remove the user from collaborators
    dreamTrip.collaborators.splice(collaboratorIndex, 1);
    await dreamTrip.save();

    // Log the activity
    await logActivity({
      user: req.user._id,
      action: 'leave_trip',
      entityType: 'dream_trip',
      entityId: dreamTrip._id,
      details: {
        collaboratorEmail: user.email,
        collaboratorName: user.name,
        role: collaborator.role
      }
    });

    res.json({ message: 'Successfully left the trip' });
  } catch (error) {
    console.error('Error leaving dream trip:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 