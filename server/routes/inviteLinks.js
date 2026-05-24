const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');
const Trip = require('../models/Trip');
const TripInvitation = require('../models/TripInvitation');
const { logActivity } = require('../utils/activityLogger');
const { getFrontendUrl } = require('../utils/frontendUrl');
const { serializeTrip } = require('../utils/tripSerializer');

const router = express.Router();

const serializeInviteLink = (invitation, req) => ({
  _id: invitation._id,
  role: invitation.role,
  status: invitation.status,
  inviteUrl: `${getFrontendUrl(req)}/trips/invite/${invitation.token}`,
  expiresAt: invitation.expiresAt,
  createdAt: invitation.createdAt,
  createdBy: invitation.createdBy,
  acceptedUsers: invitation.acceptedUsers
});

const canManageInviteLinks = (trip, userId) => {
  const accessRole = trip.hasAccess(userId);
  return accessRole && accessRole !== 'viewer';
};

// Accept route must stay before /trips/:id/invite-links to avoid path ambiguity.
router.post('/trips/invite-links/:token/accept', auth, async (req, res) => {
  try {
    const invitation = await TripInvitation.findOne({ token: req.params.token });
    if (!invitation) {
      return res.status(404).json({ message: 'Invite link not found' });
    }

    if (invitation.status !== 'active') {
      return res.status(410).json({ message: 'This invite link has been revoked' });
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return res.status(410).json({ message: 'This invite link has expired' });
    }

    const trip = await Trip.findById(invitation.trip);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    const currentAccess = trip.hasAccess(req.user._id);
    const userId = req.user._id;

    // Atomic add — prevents duplicate collaborators from concurrent accept requests.
    await Trip.updateOne(
      {
        _id: invitation.trip,
        owner: { $ne: userId },
        'collaborators.user': { $ne: userId },
      },
      { $push: { collaborators: { user: userId, role: invitation.role } } }
    );

    await TripInvitation.updateOne(
      {
        _id: invitation._id,
        'acceptedUsers.user': { $ne: userId },
      },
      { $push: { acceptedUsers: { user: userId, acceptedAt: new Date() } } }
    );

    const populatedTrip = await Trip.findById(invitation.trip)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl')
      .lean()
      .exec();

    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'collaborator_invite_accept',
      description: `${req.user.name} accepted a ${invitation.role} invite link for trip "${trip.name}"`,
      details: {
        tripName: trip.name,
        role: invitation.role,
        invitationId: invitation._id
      }
    });

    res.json({ trip: serializeTrip(populatedTrip), role: currentAccess || invitation.role });
  } catch (error) {
    console.error('Error accepting trip invite link:', error);
    res.status(500).json({ message: error.message || 'Failed to accept invite link' });
  }
});

router.get('/trips/:id/invite-links', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (!canManageInviteLinks(trip, req.user._id)) {
      return res.status(403).json({ message: 'You do not have permission to manage invite links for this trip' });
    }

    const invitations = await TripInvitation.find({ trip: trip._id, status: 'active' })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email photoUrl')
      .populate('acceptedUsers.user', 'name email photoUrl');

    res.json(invitations.map(invitation => serializeInviteLink(invitation, req)));
  } catch (error) {
    console.error('Error loading trip invite links:', error);
    res.status(500).json({ message: error.message || 'Failed to load invite links' });
  }
});

router.post('/trips/:id/invite-links', auth, async (req, res) => {
  try {
    const { role = 'viewer', expiresInDays = 30 } = req.body;
    if (!['viewer', 'editor'].includes(role)) {
      return res.status(400).json({ message: 'Invite role must be viewer or editor' });
    }

    const trip = await Trip.findById(req.params.id)
      .populate('owner', 'name email photoUrl')
      .populate('collaborators.user', 'name email photoUrl');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (!canManageInviteLinks(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only owners and editors can create invite links' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expirationDays = Math.min(Math.max(Number(expiresInDays) || 30, 1), 90);
    const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

    const invitation = await TripInvitation.create({
      trip: trip._id,
      token,
      role,
      createdBy: req.user._id,
      expiresAt
    });

    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'collaborator_invite_link_create',
      description: `Created a ${role} invite link for trip "${trip.name}"`,
      details: {
        tripName: trip.name,
        role,
        invitationId: invitation._id,
        expiresAt
      }
    });

    res.status(201).json(serializeInviteLink(invitation, req));
  } catch (error) {
    console.error('Error creating trip invite link:', error);
    res.status(500).json({ message: error.message || 'Failed to create invite link' });
  }
});

router.delete('/trips/:id/invite-links/:inviteId', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (!canManageInviteLinks(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only owners and editors can revoke invite links' });
    }

    const invitation = await TripInvitation.findOne({ _id: req.params.inviteId, trip: trip._id });
    if (!invitation) {
      return res.status(404).json({ message: 'Invite link not found' });
    }

    invitation.status = 'revoked';
    invitation.revokedBy = req.user._id;
    invitation.revokedAt = new Date();
    await invitation.save();

    await logActivity({
      userId: req.user._id,
      tripId: trip._id,
      actionType: 'collaborator_invite_link_revoke',
      description: `Revoked a ${invitation.role} invite link for trip "${trip.name}"`,
      details: {
        tripName: trip.name,
        role: invitation.role,
        invitationId: invitation._id
      }
    });

    res.json({ message: 'Invite link revoked' });
  } catch (error) {
    console.error('Error revoking trip invite link:', error);
    res.status(500).json({ message: error.message || 'Failed to revoke invite link' });
  }
});

module.exports = router;
