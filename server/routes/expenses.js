const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Trip = require('../models/Trip');
const User = require('../models/User');

const WRITABLE_EXPENSE_FIELDS = [
  'title',
  'description',
  'amount',
  'currency',
  'date',
  'paidBy',
  'splitMethod',
  'participants',
  'category',
  'receipt'
];

const WRITABLE_SETTLEMENT_FIELDS = [
  'fromUserId',
  'toUserId',
  'amount',
  'currency',
  'method',
  'status',
  'date',
  'notes'
];

const getId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

const pickFields = (source, allowedFields) => {
  return allowedFields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
    return result;
  }, {});
};

const findAccessibleTrip = (tripId, userId, populate = '') => {
  let query = Trip.findOne({
    _id: tripId,
    $or: [
      { owner: userId },
      { 'collaborators.user': userId }
    ]
  });

  if (populate) {
    populate.split(' ').filter(Boolean).forEach(path => {
      query = query.populate(path);
    });
  }

  return query;
};

const getTripRole = (trip, userId) => {
  const userIdString = userId.toString();
  if (getId(trip.owner) === userIdString) return 'owner';

  const collaborator = trip.collaborators.find(c => getId(c.user) === userIdString);
  return collaborator?.role || null;
};

const canWriteTripExpenses = (trip, userId) => {
  const role = getTripRole(trip, userId);
  return role === 'owner' || role === 'editor';
};

const getTripParticipantIds = (trip) => {
  return new Set([
    getId(trip.owner),
    ...trip.collaborators.map(c => getId(c.user))
  ].filter(Boolean));
};

const normalizeUserId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return getId(value);
  return value.toString();
};

const normalizeParticipants = (participants = []) => {
  return participants.map(participant => ({
    ...participant,
    userId: normalizeUserId(participant.userId)
  }));
};

const validateExpenseInput = (data, trip) => {
  if (!data.title?.trim()) {
    return 'Expense title is required';
  }

  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
    return 'Expense amount must be greater than 0';
  }

  if (!['equal', 'custom', 'percentage', 'shares'].includes(data.splitMethod)) {
    return 'Invalid split method';
  }

  if (!Array.isArray(data.participants) || data.participants.length === 0) {
    return 'At least one participant is required';
  }

  const tripParticipantIds = getTripParticipantIds(trip);
  const payerId = normalizeUserId(data.paidBy);

  if (!payerId || !tripParticipantIds.has(payerId)) {
    return 'Payer must be a trip participant';
  }

  const participantIds = normalizeParticipants(data.participants).map(p => p.userId);
  if (participantIds.some(id => !id || !tripParticipantIds.has(id))) {
    return 'All split participants must belong to the trip';
  }

  if (new Set(participantIds).size !== participantIds.length) {
    return 'Split participants must be unique';
  }

  return null;
};

const buildExpensePayload = (body, tripId, fallbackUserId) => {
  const payload = pickFields(body, WRITABLE_EXPENSE_FIELDS);
  payload.tripId = tripId;
  payload.paidBy = normalizeUserId(payload.paidBy) || fallbackUserId;
  payload.participants = normalizeParticipants(payload.participants);
  return payload;
};

const validateSettlementInput = (data, trip) => {
  const fromUserId = normalizeUserId(data.fromUserId);
  const toUserId = normalizeUserId(data.toUserId);
  const tripParticipantIds = getTripParticipantIds(trip);

  if (!fromUserId || !toUserId) {
    return 'Both settlement users are required';
  }

  if (fromUserId === toUserId) {
    return 'Settlement users must be different people';
  }

  if (!tripParticipantIds.has(fromUserId) || !tripParticipantIds.has(toUserId)) {
    return 'Both users must be participants in the trip';
  }

  if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
    return 'Settlement amount must be greater than 0';
  }

  return null;
};

const buildSettlementPayload = (body, tripId) => {
  const payload = pickFields(body, WRITABLE_SETTLEMENT_FIELDS);
  payload.tripId = tripId;
  payload.fromUserId = normalizeUserId(payload.fromUserId);
  payload.toUserId = normalizeUserId(payload.toUserId);
  return payload;
};

const calculateSummary = (trip, expenses, settlements) => {
  const participantIds = getTripParticipantIds(trip);
  const totalsByCurrency = {};

  const ensureCurrencyTotals = (currency) => {
    if (!totalsByCurrency[currency]) {
      totalsByCurrency[currency] = {
        totalAmount: 0,
        unsettledAmount: 0
      };
    }
    return totalsByCurrency[currency];
  };

  const perCurrencyBalances = {};
  const ensureCurrencyBalances = (currency) => {
    ensureCurrencyTotals(currency);
    if (!perCurrencyBalances[currency]) {
      perCurrencyBalances[currency] = {};
      participantIds.forEach(participantId => {
        perCurrencyBalances[currency][participantId] = 0;
      });
    }
    return perCurrencyBalances[currency];
  };

  expenses.forEach(expense => {
    const currency = expense.currency || 'USD';
    const payerId = getId(expense.paidBy);
    const amount = Number(expense.amount) || 0;
    const currencyBalances = ensureCurrencyBalances(currency);

    ensureCurrencyTotals(currency).totalAmount += amount;

    expense.participants.forEach(participant => {
      if (participant.settled) return;
      const participantId = getId(participant.userId);
      const share = Number(participant.share) || 0;
      currencyBalances[payerId] = (currencyBalances[payerId] || 0) + share;
      currencyBalances[participantId] = (currencyBalances[participantId] || 0) - share;
    });
  });

  settlements.forEach(settlement => {
    if (settlement.status !== 'completed') return;

    const currency = settlement.currency || 'USD';
    const fromUserId = getId(settlement.fromUserId);
    const toUserId = getId(settlement.toUserId);
    const amount = Number(settlement.amount) || 0;
    const currencyBalances = ensureCurrencyBalances(currency);

    currencyBalances[fromUserId] = (currencyBalances[fromUserId] || 0) + amount;
    currencyBalances[toUserId] = (currencyBalances[toUserId] || 0) - amount;
  });

  Object.entries(perCurrencyBalances).forEach(([currency, balances]) => {
    ensureCurrencyTotals(currency).unsettledAmount = Object.values(balances).reduce((sum, balance) => {
      return sum + Math.max(0, Number(balance) || 0);
    }, 0);
  });

  const currencies = Object.keys(totalsByCurrency);
  const hasMixedCurrencies = currencies.length > 1;
  const totalAmount = currencies.length === 1
    ? totalsByCurrency[currencies[0]].totalAmount
    : 0;
  const perPersonBalances = currencies.length === 1
    ? perCurrencyBalances[currencies[0]]
    : {};
  const unsettledAmount = currencies.length === 1
    ? totalsByCurrency[currencies[0]].unsettledAmount
    : 0;

  return {
    totalAmount,
    perPersonBalances,
    perCurrencyBalances,
    unsettledAmount,
    currency: hasMixedCurrencies ? 'MULTI' : currencies[0] || 'USD',
    currencyTotals: totalsByCurrency,
    hasMixedCurrencies,
    includesSettlements: true
  };
};

const transformExpense = (expense) => ({
  ...expense.toObject(),
  participants: expense.participants.map(participant => ({
    ...participant.toObject(),
    userId: participant.userId._id.toString(),
    name: participant.userId.name,
    photoUrl: participant.userId.photoUrl
  }))
});

// Get all expenses for a trip
router.get('/trips/:tripId/expenses', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

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
        userId: participant.userId._id.toString(),
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
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    if (!canWriteTripExpenses(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only trip owners and editors can add expenses' });
    }

    const expensePayload = buildExpensePayload(req.body, req.params.tripId, req.user._id);
    const validationError = validateExpenseInput(expensePayload, trip);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const expense = new Expense(expensePayload);

    await expense.save();
    await expense.populate('paidBy', 'name email photoUrl');
    await expense.populate('participants.userId', 'name email photoUrl');

    res.status(201).json(transformExpense(expense));
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to add expense' });
  }
});

// Update an expense
router.put('/trips/:tripId/expenses/:expenseId', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

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

    if (!canWriteTripExpenses(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only trip owners and editors can update expenses' });
    }

    const expensePayload = buildExpensePayload({
      ...expense.toObject(),
      ...pickFields(req.body, WRITABLE_EXPENSE_FIELDS)
    }, req.params.tripId, expense.paidBy);
    const validationError = validateExpenseInput(expensePayload, trip);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    Object.assign(expense, expensePayload);
    await expense.save();
    await expense.populate('paidBy', 'name email photoUrl');
    await expense.populate('participants.userId', 'name email photoUrl');

    res.json(transformExpense(expense));
  } catch (error) {
    res.status(400).json({ message: error.message || 'Failed to update expense' });
  }
});

// Delete an expense
router.delete('/trips/:tripId/expenses/:expenseId', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

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

    if (!canWriteTripExpenses(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only trip owners and editors can delete expenses' });
    }

    await expense.deleteOne();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark an expense as settled for a participant
router.post('/trips/:tripId/expenses/:expenseId/settle', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    if (!canWriteTripExpenses(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only trip owners and editors can settle expense shares' });
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
    await expense.populate('paidBy', 'name email photoUrl');
    await expense.populate('participants.userId', 'name email photoUrl');

    res.json(transformExpense(expense));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all settlements for a trip
router.get('/trips/:tripId/settlements', auth, async (req, res) => {
  try {
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

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
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    if (!canWriteTripExpenses(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only trip owners and editors can add settlements' });
    }

    const settlementPayload = buildSettlementPayload(req.body, req.params.tripId);
    const validationError = validateSettlementInput(settlementPayload, trip);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const fromUser = await User.findById(settlementPayload.fromUserId);
    const toUser = await User.findById(settlementPayload.toUserId);

    if (!fromUser || !toUser) {
      return res.status(400).json({ message: 'Invalid user IDs provided' });
    }

    const settlement = new Settlement({
      ...settlementPayload,
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
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    if (!canWriteTripExpenses(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only trip owners and editors can update settlements' });
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
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    if (!canWriteTripExpenses(trip, req.user._id)) {
      return res.status(403).json({ message: 'Only trip owners and editors can delete settlements' });
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
    const trip = await findAccessibleTrip(req.params.tripId, req.user._id, 'owner collaborators.user');

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or access denied' });
    }

    const expenses = await Expense.find({ tripId: req.params.tripId })
      .populate('paidBy')
      .populate('participants.userId');
      
    const settlements = await Settlement.find({ tripId: req.params.tripId })
      .populate('fromUserId')
      .populate('toUserId');

    res.json(calculateSummary(trip, expenses, settlements));
  } catch (error) {
    console.error('Error calculating expense summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 