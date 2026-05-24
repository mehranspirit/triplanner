import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Expense, SplitMethod } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import Avatar from '../Avatar';
import { suggestCategory, CategorySuggestion } from '../../utils/categorySuggestions';
import { createParticipantWithSplitDetails, calculateEqualShare } from '../../utils/expenseUtils';
import { useEvent } from '../../contexts/EventContext';
import { getEventTypeLabel } from '../../config/eventTypes';
import { EXPENSE_CATEGORIES, EXPENSE_CURRENCIES } from '../../utils/expenseOptions';
import { formatCurrency } from '../../utils/format';

interface AddExpenseProps {
  tripId: string;
  participants: User[];
  currentUser: User;
  onExpenseAdded?: () => void;
  onCancel?: () => void;
}

const getInitialCurrency = () => {
  if (typeof window === 'undefined') return 'USD';
  return window.localStorage.getItem('expense:lastCurrency') || 'USD';
};

const getInitialSplitMethod = (): SplitMethod => {
  return 'equal';
};

const EXPENSE_TEMPLATES = [
  { label: 'Meal', title: 'Meal', category: 'Food & Drinks', subcategory: 'Restaurants' },
  { label: 'Taxi', title: 'Taxi', category: 'Transportation', subcategory: 'Taxis/Rideshares' },
  { label: 'Hotel', title: 'Hotel', category: 'Accommodation', subcategory: 'Hotels' },
  { label: 'Tickets', title: 'Tickets', category: 'Activities & Entertainment', subcategory: 'Attractions' },
  { label: 'Groceries', title: 'Groceries', category: 'Food & Drinks', subcategory: 'Groceries' },
  { label: 'Gas', title: 'Gas', category: 'Transportation', subcategory: 'Fuel' },
];

export const AddExpense: React.FC<AddExpenseProps> = ({ tripId, participants, currentUser, onExpenseAdded, onCancel }) => {
  const { addExpense, expenses } = useExpense();
  const { events } = useEvent();
  const defaultPayerId = participants.some(p => p._id === currentUser._id)
    ? currentUser._id
    : participants[0]?._id || '';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(getInitialCurrency);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(getInitialSplitMethod);
  const [participantShares, setParticipantShares] = useState<{ [key: string]: number }>({});
  const [selectedPayer, setSelectedPayer] = useState(defaultPayerId);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    participants.map(p => p._id)
  );
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [splitWarning, setSplitWarning] = useState<string | null>(null);
  const [expenseSource, setExpenseSource] = useState<'manual' | 'event'>('manual');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(splitMethod !== 'equal');

  React.useEffect(() => {
    const participantIds = participants.map(participant => participant._id);

    setSelectedPayer(prev => (
      participantIds.includes(prev) ? prev : defaultPayerId
    ));

    setSelectedParticipants(prev => {
      const retained = prev.filter(id => participantIds.includes(id));
      const missing = participantIds.filter(id => !retained.includes(id));

      if (retained.length === prev.length && missing.length === 0) {
        return prev;
      }

      return [...retained, ...missing];
    });

    setParticipantShares(prev => Object.fromEntries(
      Object.entries(prev).filter(([userId]) => participantIds.includes(userId))
    ));
  }, [defaultPayerId, participants]);

  // Filter events with cost
  const eventsWithCost = events.filter(e => typeof e.cost === 'number' && e.cost > 0);

  // Helper to format date range
  const formatEventDateRange = (event: any) => {
    if (event.startDate && event.endDate) {
      return `${event.startDate.substring(0, 10)} - ${event.endDate.substring(0, 10)}`;
    }
    return event.startDate ? event.startDate.substring(0, 10) : '';
  };

  // Helper to get event title safely
  const getEventTitle = (event: any) => {
    switch (event.type) {
      case 'activity':
        return event.title;
      case 'stay':
        return event.accommodationName;
      case 'destination':
        return event.placeName;
      case 'flight':
        return event.flightNumber ? `Flight ${event.flightNumber}` : 'Flight';
      case 'train':
        return event.trainNumber ? `Train ${event.trainNumber}` : 'Train';
      case 'rental_car':
        return event.carCompany || 'Rental Car';
      case 'bus':
        return event.busNumber ? `Bus ${event.busNumber}` : 'Bus';
      default:
        return getEventTypeLabel(event.type as import('../../types/eventTypes').EventType) || event.type;
    }
  };

  // Helper to get event description safely
  const getEventDescription = (event: any) => {
    switch (event.type) {
      case 'activity':
      case 'destination':
        return event.description || '';
      case 'stay':
        return event.address || '';
      case 'flight':
        return `${event.departureAirport || ''} → ${event.arrivalAirport || ''}`;
      case 'train':
        return `${event.departureStation || ''} → ${event.arrivalStation || ''}`;
      case 'rental_car':
        return `${event.pickupLocation || ''} → ${event.dropoffLocation || ''}`;
      case 'bus':
        return `${event.departureStation || ''} → ${event.arrivalStation || ''}`;
      default:
        return '';
    }
  };

  const getCategoryForEvent = (event: any) => {
    switch (event.type) {
      case 'flight':
      case 'train':
      case 'bus':
      case 'rental_car':
        return {
          category: 'Transportation',
          subcategory:
            event.type === 'flight' ? 'Flights' :
            event.type === 'train' ? 'Trains' :
            event.type === 'bus' ? 'Buses' :
            event.type === 'rental_car' ? 'Car Rental' : '',
        };
      case 'stay':
        return { category: 'Accommodation', subcategory: 'Hotels' };
      case 'activity':
        return { category: 'Activities & Entertainment', subcategory: 'Attractions' };
      default:
        return { category: 'Other', subcategory: 'Miscellaneous' };
    }
  };

  const applyEventToForm = (event: any) => {
    const { category, subcategory } = getCategoryForEvent(event);
    setExpenseSource('event');
    setSelectedEventId(event.id);
    setAmount(event.cost?.toString() || '');
    setSelectedCategory(category);
    setSelectedSubcategory(subcategory);
    setTitle(getEventTitle(event));
    setDescription(getEventDescription(event));
    setFormError(null);
  };

  const handleTemplateClick = (template: typeof EXPENSE_TEMPLATES[number]) => {
    setTitle(template.title);
    setSelectedCategory(template.category);
    setSelectedSubcategory(template.subcategory);
    setShowSuggestion(false);
    setFormError(null);
  };

  // When event is picked, auto-fill amount and suggest category
  React.useEffect(() => {
    if (expenseSource === 'event' && selectedEventId) {
      const event = eventsWithCost.find(e => e.id === selectedEventId);
      if (event) {
        applyEventToForm(event);
      }
    }
    if (expenseSource === 'manual') {
      setSelectedEventId('');
    }
  }, [expenseSource, selectedEventId]);

  const validateSplits = () => {
    if (splitMethod === 'equal') return true;

    const total = Object.values(participantShares).reduce((sum, share) => sum + (share || 0), 0);
    
    if (splitMethod === 'percentage') {
      return Math.abs(total - 100) <= 0.1;
    } else if (splitMethod === 'custom') {
      return Math.abs(total - parseFloat(amount)) <= 0.01;
    } else if (splitMethod === 'shares') {
      return total > 0;
    }
    
    return true;
  };

  const getSplitWarning = () => {
    if (splitMethod === 'equal') return null;

    const total = Object.values(participantShares).reduce((sum, share) => sum + (share || 0), 0);
    
    if (splitMethod === 'percentage') {
      const diff = Math.abs(total - 100);
      if (diff > 0.1) {
        return `Total percentage (${total.toFixed(1)}%) must equal 100%`;
      }
    } else if (splitMethod === 'custom') {
      const diff = Math.abs(total - parseFloat(amount));
      if (diff > 0.01) {
        return `Total amount (${total.toFixed(2)} ${currency}) must equal expense amount (${amount} ${currency})`;
      }
    } else if (splitMethod === 'shares') {
      if (total <= 0) {
        return 'Total shares must be greater than 0';
      }
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setDuplicateWarning(null);

    const expenseAmount = parseFloat(amount);
    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }

    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }

    if (selectedParticipants.length === 0) {
      setFormError('Select at least one person to split this expense with.');
      return;
    }

    // First validate splits
    if (!validateSplits()) {
      const warning = getSplitWarning();
      if (warning) {
        setSplitWarning(warning);
        return;
      }
    }

    // Check for duplicates before proceeding
    const duplicateExpense = expenses.find(exp => {
      // Check if the expense is from the same event
      const isSameEvent = exp.title === title;
      // Check if the amount matches (with a small tolerance for floating point differences)
      const isSameAmount = Math.abs(exp.amount - parseFloat(amount)) < 0.01;
      // Check if the category matches
      const isSameCategory = exp.category === (selectedSubcategory || selectedCategory);
      
      return isSameEvent && isSameAmount && isSameCategory;
    });

    if (duplicateExpense && !allowDuplicate) {
      setDuplicateWarning(`An expense for "${title}" with the same amount and category already exists. Review it before adding another one.`);
      return;
    }

    const payer = participants.find(p => p._id === selectedPayer);
    if (!payer) {
      setFormError('Selected payer was not found.');
      return;
    }

    setIsSaving(true);

    const expense: Omit<Expense, '_id'> = {
      tripId,
      title,
      description,
      amount: expenseAmount,
      currency,
      date,
      paidBy: {
        _id: payer._id,
        name: payer.name,
        email: payer.email,
        photoUrl: payer.photoUrl
      },
      splitMethod,
      category: selectedSubcategory || selectedCategory,
      participants: participants
        .filter(p => selectedParticipants.includes(p._id))
        .map(participant => createParticipantWithSplitDetails(
          participant,
          splitMethod,
          expenseAmount,
          selectedParticipants,
          participantShares
        )),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      window.localStorage.setItem('expense:lastCurrency', currency);
      window.localStorage.setItem('expense:lastSplitMethod', splitMethod);
      await addExpense(tripId, expense);
      
      // Reset form
      setTitle('');
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setSplitMethod('equal');
      setShowAdvanced(false);
      setParticipantShares({});
      setSelectedPayer(defaultPayerId);
      setSelectedParticipants(participants.map(p => p._id));
      setSelectedCategory('');
      setSelectedSubcategory('');
      setAllowDuplicate(false);
      setDuplicateWarning(null);
      
      if (onExpenseAdded) {
        onExpenseAdded();
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEventExpense = async (event: any) => {
    const eventAmount = Number(event.cost) || 0;
    const payer = participants.find(p => p._id === selectedPayer);
    if (!payer || eventAmount <= 0 || selectedParticipants.length === 0) {
      applyEventToForm(event);
      setFormError('Review the suggested expense before adding it.');
      return;
    }

    const eventTitle = getEventTitle(event);
    const { category, subcategory } = getCategoryForEvent(event);
    const duplicateExpense = expenses.find(exp => (
      exp.title === eventTitle &&
      Math.abs(exp.amount - eventAmount) < 0.01 &&
      exp.category === (subcategory || category)
    ));

    if (duplicateExpense && !allowDuplicate) {
      applyEventToForm(event);
      setDuplicateWarning(`An expense for "${eventTitle}" with the same amount and category already exists. Review it before adding another one.`);
      return;
    }

    setIsSaving(true);
    setFormError(null);
    setDuplicateWarning(null);

    const expense: Omit<Expense, '_id'> = {
      tripId,
      title: eventTitle,
      description: getEventDescription(event),
      amount: eventAmount,
      currency,
      date: event.startDate ? event.startDate.substring(0, 10) : new Date().toISOString().split('T')[0],
      paidBy: {
        _id: payer._id,
        name: payer.name,
        email: payer.email,
        photoUrl: payer.photoUrl
      },
      splitMethod: 'equal',
      category: subcategory || category,
      participants: participants
        .filter(p => selectedParticipants.includes(p._id))
        .map(participant => createParticipantWithSplitDetails(
          participant,
          'equal',
          eventAmount,
          selectedParticipants,
          {}
        )),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      window.localStorage.setItem('expense:lastCurrency', currency);
      await addExpense(tripId, expense);
      onExpenseAdded?.();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to add suggested expense.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareChange = (userId: string, value: string) => {
    const newValue = parseFloat(value) || 0;
    setParticipantShares(prev => ({
      ...prev,
      [userId]: newValue
    }));

    // Update warning message
    const newShares = { ...participantShares, [userId]: newValue };
    const total = Object.values(newShares).reduce((sum, share) => sum + (share || 0), 0);
    
    if (splitMethod === 'percentage') {
      const diff = Math.abs(total - 100);
      if (diff > 0.1) {
        setSplitWarning(`Total percentage (${total.toFixed(1)}%) must equal 100%`);
      } else {
        setSplitWarning(null);
      }
    } else if (splitMethod === 'custom') {
      const diff = Math.abs(total - parseFloat(amount));
      if (diff > 0.01) {
        setSplitWarning(`Total amount (${total.toFixed(2)} ${currency}) must equal expense amount (${amount} ${currency})`);
      } else {
        setSplitWarning(null);
      }
    } else if (splitMethod === 'shares') {
      if (total <= 0) {
        setSplitWarning('Total shares must be greater than 0');
      } else {
        setSplitWarning(null);
      }
    }
  };

  const handleParticipantToggle = (userId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        setFormError(null);
        return [...prev, userId];
      }
    });
  };

  const handleSplitMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSplitMethod = e.target.value as SplitMethod;
    setSplitMethod(newSplitMethod);
    setSplitWarning(null); // Clear warning when changing split method
    
    // Reset shares when changing split method
    const numParticipants = selectedParticipants.length;
    if (newSplitMethod === 'equal') {
      setParticipantShares({});
    } else if (newSplitMethod === 'percentage') {
      // Round to 1 decimal place for percentages
      const equalPercentage = Math.round((100 / numParticipants) * 10) / 10;
      const shares: { [key: string]: number } = selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: equalPercentage }), {});
      // Adjust the last participant to ensure total is exactly 100%
      const lastId = selectedParticipants[selectedParticipants.length - 1];
      const total = Object.values(shares).reduce((sum: number, share: number) => sum + share, 0);
      shares[lastId] = Math.round((100 - (total - equalPercentage)) * 10) / 10;
      setParticipantShares(shares);
    } else if (newSplitMethod === 'shares') {
      setParticipantShares(
        selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: 1 }), {})
      );
    } else {
      const equalAmount = calculateEqualShare(parseFloat(amount), numParticipants);
      setParticipantShares(
        selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: equalAmount }), {})
      );
    }
  };

  const handlePaidByMe = () => {
    setSelectedPayer(defaultPayerId);
    setFormError(null);
  };

  const handleEveryone = () => {
    setSelectedParticipants(participants.map(p => p._id));
    setFormError(null);
  };

  const handleJustMe = () => {
    setSelectedParticipants(defaultPayerId ? [defaultPayerId] : []);
    setFormError(null);
  };

  const handleJustMeAnd = () => {
    const otherParticipant = participants.find(p => p._id !== defaultPayerId);
    setSelectedParticipants([defaultPayerId, otherParticipant?._id].filter(Boolean) as string[]);
    setFormError(null);
  };

  const handleExcludeMe = () => {
    const withoutCurrentUser = participants
      .filter(p => p._id !== currentUser._id)
      .map(p => p._id);
    setSelectedParticipants(withoutCurrentUser.length > 0 ? withoutCurrentUser : participants.map(p => p._id));
    setFormError(null);
  };

  const handleFromItinerary = () => {
    setExpenseSource('event');
    setShowAdvanced(true);
  };

  const handlePayerChange = (payerId: string) => {
    setSelectedPayer(payerId);
    setFormError(null);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // Get suggestion when title changes
    const suggestion = suggestCategory(newTitle, description);
    setCategorySuggestion(suggestion);
    setShowSuggestion(!!suggestion);
    if (suggestion) {
      setSelectedCategory(suggestion.mainCategory);
      setSelectedSubcategory(suggestion.subCategory);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
    
    // Update suggestion when description changes
    const suggestion = suggestCategory(title, newDescription);
    setCategorySuggestion(suggestion);
    setShowSuggestion(!!suggestion);
  };

  const handleApplySuggestion = () => {
    if (categorySuggestion) {
      setSelectedCategory(categorySuggestion.mainCategory);
      setSelectedSubcategory(categorySuggestion.subCategory);
      setShowSuggestion(false);
    }
  };

  const expenseAmount = parseFloat(amount);
  const selectedPayerName = participants.find(p => p._id === selectedPayer)?.name || 'Someone';
  const selectedParticipantRecords = participants.filter(p => selectedParticipants.includes(p._id));
  const currentUserShare = splitMethod === 'equal' && selectedParticipants.includes(currentUser._id)
    ? calculateEqualShare(expenseAmount, selectedParticipants.length)
    : 0;
  const splitPreview = (() => {
    if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
      return 'Enter an amount to preview the split.';
    }
    if (selectedParticipants.length === 0) {
      return 'Choose who should share this expense.';
    }
    if (splitMethod === 'equal') {
      const perPerson = calculateEqualShare(expenseAmount, selectedParticipants.length);
      if (selectedParticipants.length === participants.length) {
        return `Everyone pays ${formatCurrency(perPerson, currency)} each.`;
      }
      if (selectedParticipants.length === 1 && selectedParticipants[0] === currentUser._id) {
        return `Only you are paying ${formatCurrency(expenseAmount, currency)}.`;
      }
      if (selectedPayer === currentUser._id) {
        const owedToYou = expenseAmount - currentUserShare;
        return selectedParticipants.includes(currentUser._id)
          ? `${selectedParticipants.length - 1} ${selectedParticipants.length - 1 === 1 ? 'person owes' : 'people owe'} you ${formatCurrency(owedToYou, currency)} total.`
          : `${selectedParticipants.length} ${selectedParticipants.length === 1 ? 'person owes' : 'people owe'} you ${formatCurrency(expenseAmount, currency)} total.`;
      }
      if (selectedParticipants.includes(currentUser._id)) {
        return `You owe ${selectedPayerName} ${formatCurrency(perPerson, currency)}.`;
      }
      return `${selectedPayerName} paid. ${selectedParticipants.length} people split ${formatCurrency(perPerson, currency)} each.`;
    }
    return `${selectedPayerName} paid ${formatCurrency(expenseAmount, currency)}. Review the advanced split before adding.`;
  })();

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {formError}
        </div>
      )}

      {eventsWithCost.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-blue-950">Suggested from itinerary</p>
              <p className="text-xs text-blue-700">Use event costs as a starting point.</p>
            </div>
            <button type="button" onClick={handleFromItinerary} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
              More
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {eventsWithCost.slice(0, 4).map(event => (
              <div
                key={event.id}
                className="min-w-[200px] rounded-xl border border-blue-100 bg-white p-3 text-left shadow-sm"
              >
                <p className="truncate text-sm font-semibold text-slate-950">{getEventTitle(event)}</p>
                <p className="mt-1 text-xs text-slate-500">{formatEventDateRange(event)}</p>
                <p className="mt-2 text-sm font-bold text-blue-700">{formatCurrency(event.cost || 0, currency)}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => applyEventToForm(event)}
                    className="rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddEventExpense(event)}
                    disabled={isSaving}
                    className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Add expense
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Quick templates</p>
        <div className="flex flex-wrap gap-2">
          {EXPENSE_TEMPLATES.map(template => (
            <button
              key={template.label}
              type="button"
              onClick={() => handleTemplateClick(template)}
              className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            What was it?
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={handleTitleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Dinner, taxi, hotel..."
          />
          {showSuggestion && categorySuggestion && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-600">Suggested category:</span>
              <button
                type="button"
                onClick={handleApplySuggestion}
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                {categorySuggestion.mainCategory} / {categorySuggestion.subCategory}
              </button>
              <button
                type="button"
                onClick={() => setShowSuggestion(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Amount</label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block min-w-0 flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              step="0.01"
              required
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              {EXPENSE_CURRENCIES.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-gray-700">Paid by</label>
          <button type="button" onClick={handlePaidByMe} className="text-xs font-semibold text-blue-700 hover:text-blue-900">
            Paid by me
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {participants.map((participant) => (
            <button
              key={participant._id}
              type="button"
              onClick={() => handlePayerChange(participant._id)}
              className={`flex min-h-[44px] min-w-[140px] items-center space-x-2 rounded-full border px-3 py-2 text-left hover:bg-gray-50 ${
                selectedPayer === participant._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <Avatar photoUrl={participant.photoUrl || null} name={participant.name} size="sm" className="border border-gray-200" />
              <span className="truncate text-sm text-gray-700">{participant.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700">Split between</label>
            <p className="text-xs text-gray-500">{selectedParticipantRecords.length} selected</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleEveryone} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Everyone
            </button>
            <button type="button" onClick={handleJustMe} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Just me
            </button>
            <button type="button" onClick={handleJustMeAnd} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Me + one
            </button>
            <button type="button" onClick={handleExcludeMe} className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Exclude me
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {participants.map((participant) => (
            <button
              key={participant._id}
              type="button"
              onClick={() => handleParticipantToggle(participant._id)}
              className={`flex min-h-[44px] items-center space-x-2 rounded-full border px-3 py-2 text-left hover:bg-gray-50 ${
                selectedParticipants.includes(participant._id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <Avatar photoUrl={participant.photoUrl || null} name={participant.name} size="sm" className="border border-gray-200" />
              <span className="truncate text-sm text-gray-700">{participant.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
        {splitPreview}
      </div>

      <div className="rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={() => setShowAdvanced(prev => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900"
          aria-expanded={showAdvanced}
        >
          <span>More options</span>
          <span className="text-blue-600">{showAdvanced ? 'Hide' : 'Show'}</span>
        </button>

        {showAdvanced && (
          <div className="space-y-4 border-t border-gray-100 p-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expense source</label>
              <select
                value={expenseSource}
                onChange={e => setExpenseSource(e.target.value as 'manual' | 'event')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="manual">Enter manually</option>
                <option value="event">From event with cost</option>
              </select>
            </div>

            {expenseSource === 'event' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select event</label>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Select an event</option>
                  {eventsWithCost.map(event => (
                    <option key={event.id} value={event.id}>
                      {getEventTitle(event)} | {formatCurrency(event.cost || 0, currency)} | {formatEventDateRange(event)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Split method</label>
                <select
                  value={splitMethod}
                  onChange={handleSplitMethodChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="shares">Shares</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory('');
                  }}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select a category</option>
                  {Object.keys(EXPENSE_CATEGORIES).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {selectedCategory && EXPENSE_CATEGORIES[selectedCategory as keyof typeof EXPENSE_CATEGORIES] && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
                  <select
                    value={selectedSubcategory}
                    onChange={(e) => setSelectedSubcategory(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select a subcategory</option>
                    {EXPENSE_CATEGORIES[selectedCategory as keyof typeof EXPENSE_CATEGORIES].map(subcategory => (
                      <option key={subcategory} value={subcategory}>{subcategory}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="description"
                value={description}
                onChange={handleDescriptionChange}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Optional context"
              />
            </div>

            {splitMethod !== 'equal' && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Individual shares</h4>
                {splitWarning && (
                  <div className="p-2 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                    {splitWarning}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {participants
                    .filter(p => selectedParticipants.includes(p._id))
                    .map((participant) => (
                      <div key={participant._id} className="flex items-center space-x-2">
                        <Avatar photoUrl={participant.photoUrl || null} name={participant.name} size="sm" className="border border-gray-200" />
                        <div className="flex-1">
                          <label className="block text-sm text-gray-700">{participant.name}</label>
                          <div className="mt-1 flex items-center space-x-2">
                            <input
                              type="number"
                              value={participantShares[participant._id] || ''}
                              onChange={(e) => handleShareChange(participant._id, e.target.value)}
                              className={`block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm ${
                                splitWarning ? 'border-red-300' : 'border-gray-300'
                              }`}
                              step="0.01"
                              min="0"
                            />
                            <span className="text-sm text-gray-500">
                              {splitMethod === 'percentage' ? '%' : currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {duplicateWarning && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-sm text-yellow-700">{duplicateWarning}</p>
          <button
            type="button"
            onClick={() => {
              setAllowDuplicate(true);
              setDuplicateWarning(null);
            }}
            className="mt-2 text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
          >
            Add it anyway
          </button>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-gray-200 bg-white p-4 sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">{splitPreview}</p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel || onExpenseAdded}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                isSaving ? 'opacity-75 cursor-not-allowed' : ''
              }`}
            >
              {isSaving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}; 