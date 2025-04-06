const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Trip = require('../models/Trip');
const User = require('../models/User');

// Get all expenses for a trip
router.get('/trips/:tripId/expenses', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const expenses = await Expense.find({ tripId: req.params.tripId })
      .populate('paidBy', 'name email photoUrl')
      .populate('participants.userId', 'name email photoUrl')
      .lean();

    // Transform the response to include user data in participants
    const transformedExpenses = expenses.map(expense => ({
      ...expense,
      participants: expense.participants.map(participant => ({
        ...participant,
        name: participant.userId.name,
        photoUrl: participant.userId.photoUrl
      }))
    }));

    res.json(transformedExpenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a new expense
router.post('/trips/:tripId/expenses', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    // Only set paidBy to current user if not provided in request
    const expense = new Expense({
      ...req.body,
      tripId: req.params.tripId,
      paidBy: req.body.paidBy || req.user._id
    });

    await expense.save();
    await expense.populate('paidBy', 'name email photoUrl');
    await expense.populate('participants.userId', 'name email photoUrl');

    // Transform the response to include user data in participants
    const transformedExpense = {
      ...expense.toObject(),
      participants: expense.participants.map(participant => ({
        ...participant.toObject(),
        name: participant.userId.name,
        photoUrl: participant.userId.photoUrl
      }))
    };

    res.status(201).json(transformedExpense);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an expense
router.put('/trips/:tripId/expenses/:expenseId', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const expense = await Expense.findOne({
      _id: req.params.expenseId,
      tripId: req.params.tripId
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    if (expense.paidBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this expense' });
    }

    Object.assign(expense, req.body);
    await expense.save();
    await expense.populate('paidBy', 'name email photoUrl');
    await expense.populate('participants.userId', 'name email photoUrl');

    // Transform the response to include user data in participants
    const transformedExpense = {
      ...expense.toObject(),
      participants: expense.participants.map(participant => ({
        ...participant.toObject(),
        name: participant.userId.name,
        photoUrl: participant.userId.photoUrl
      }))
    };

    res.json(transformedExpense);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete an expense
router.delete('/trips/:tripId/expenses/:expenseId', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const expense = await Expense.findOne({
      _id: req.params.expenseId,
      tripId: req.params.tripId
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Remove the paidBy check to allow all collaborators to delete
    await expense.deleteOne();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark an expense as settled for a participant
router.post('/trips/:tripId/expenses/:expenseId/settle', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const expense = await Expense.findOne({
      _id: req.params.expenseId,
      tripId: req.params.tripId
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const participant = expense.participants.find(
      p => p.userId.toString() === req.body.participantId
    );

    if (!participant) {
      return res.status(404).json({ message: 'Participant not found in this expense' });
    }

    participant.settled = true;
    await expense.save();

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all settlements for a trip
router.get('/trips/:tripId/settlements', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const settlements = await Settlement.find({ tripId: req.params.tripId })
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email');

    res.json(settlements);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a new settlement
router.post('/trips/:tripId/settlements', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    // Validate that both users are participants in the trip
    const fromUser = await User.findById(req.body.fromUserId);
    const toUser = await User.findById(req.body.toUserId);

    if (!fromUser || !toUser) {
      return res.status(400).json({ message: 'Invalid user IDs provided' });
    }

    const isFromUserParticipant = trip.owner._id.equals(fromUser._id) || 
      trip.collaborators.some(c => c.user._id.equals(fromUser._id));
    const isToUserParticipant = trip.owner._id.equals(toUser._id) || 
      trip.collaborators.some(c => c.user._id.equals(toUser._id));

    if (!isFromUserParticipant || !isToUserParticipant) {
      return res.status(400).json({ message: 'Both users must be participants in the trip' });
    }

    const settlement = new Settlement({
      ...req.body,
      tripId: req.params.tripId,
      fromUserId: fromUser._id,
      toUserId: toUser._id
    });

    await settlement.save();
    await settlement.populate('fromUserId', 'name email');
    await settlement.populate('toUserId', 'name email');

    res.status(201).json(settlement);
  } catch (error) {
    console.error('Error creating settlement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a settlement
router.put('/trips/:tripId/settlements/:settlementId', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const settlement = await Settlement.findOne({
      _id: req.params.settlementId,
      tripId: req.params.tripId
    });

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    // Only allow updating status, method, and notes
    if (req.body.status) settlement.status = req.body.status;
    if (req.body.method) settlement.method = req.body.method;
    if (req.body.notes) settlement.notes = req.body.notes;

    await settlement.save();
    await settlement.populate('fromUserId', 'name email');
    await settlement.populate('toUserId', 'name email');

    res.json(settlement);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a settlement
router.delete('/trips/:tripId/settlements/:settlementId', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const settlement = await Settlement.findOne({
      _id: req.params.settlementId,
      tripId: req.params.tripId
    });

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    await settlement.deleteOne();
    res.json({ message: 'Settlement deleted successfully' });
  } catch (error) {
    console.error('Error deleting settlement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get expense summary for a trip
router.get('/trips/:tripId/expenses/summary', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({
      _id: req.params.tripId,
      $or: [
        { owner: req.user._id },
        { 'collaborators.user': req.user._id }
      ]
    }).populate('owner').populate('collaborators.user');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const expenses = await Expense.find({ tripId: req.params.tripId })
      .populate('paidBy')
      .populate('participants.userId');
      
    const settlements = await Settlement.find({ tripId: req.params.tripId })
      .populate('fromUserId')
      .populate('toUserId');

    // Calculate total amount spent
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Initialize balances for all participants
    const perPersonBalances = {};
    const allParticipants = new Set();

    // Add all participants to the set
    allParticipants.add(trip.owner._id.toString());
    trip.collaborators.forEach(collaborator => {
      allParticipants.add(collaborator.user._id.toString());
    });

    // Initialize all balances to 0
    allParticipants.forEach(participantId => {
      perPersonBalances[participantId] = 0;
    });

    // Process expenses
    expenses.forEach(expense => {
      const payerId = expense.paidBy._id.toString();
      const totalExpense = expense.amount;
      
      // Add the full amount to what others owe the payer
      perPersonBalances[payerId] += totalExpense;

      // Subtract each participant's share
      expense.participants.forEach(participant => {
        const participantId = participant.userId._id.toString();
        perPersonBalances[participantId] -= participant.share;
      });
    });

    // Process settlements
    settlements.forEach(settlement => {
      if (settlement.status === 'completed') {
        const fromUserId = settlement.fromUserId._id.toString();
        const toUserId = settlement.toUserId._id.toString();
        
        // When A pays B:
        // - A's balance increases (their debt decreases)
        // - B's balance decreases (what they're owed decreases)
        perPersonBalances[fromUserId] += settlement.amount;
        perPersonBalances[toUserId] -= settlement.amount;
      }
    });

    // Calculate total unsettled amount (sum of positive balances)
    const unsettledAmount = Object.values(perPersonBalances).reduce((sum, balance) => {
      return sum + Math.max(0, balance);
    }, 0);

    res.json({
      totalAmount,
      perPersonBalances,
      unsettledAmount,
      currency: expenses[0]?.currency || 'USD'
    });
  } catch (error) {
    console.error('Error calculating expense summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 