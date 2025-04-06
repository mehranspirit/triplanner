import React, { useState, useEffect } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Expense, SplitMethod } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import Avatar from '../Avatar';
import { suggestCategory, CategorySuggestion } from '../../utils/categorySuggestions';
import { createParticipantWithSplitDetails, mapUserIdToId } from '../../utils/expenseUtils';

// Define expense categories
const EXPENSE_CATEGORIES: { [key: string]: string[] } = {
  'Transportation': ['Flights', 'Trains', 'Buses', 'Taxis/Rideshares', 'Car Rental', 'Fuel', 'Parking'],
  'Accommodation': ['Hotels', 'Hostels', 'Airbnb', 'Camping', 'Other Lodging'],
  'Food & Drinks': ['Restaurants', 'Cafes', 'Groceries', 'Street Food', 'Bars', 'Snacks'],
  'Activities & Entertainment': ['Museums', 'Tours', 'Attractions', 'Shows', 'Sports', 'Recreation'],
  'Shopping': ['Souvenirs', 'Clothes', 'Electronics', 'Gifts', 'Other Items'],
  'Utilities & Services': ['Internet', 'Phone', 'Laundry', 'Cleaning', 'Other Services'],
  'Health & Medical': ['Medicine', 'Insurance', 'Medical Services', 'First Aid'],
  'Other': ['Tips', 'Fees', 'Emergency', 'Miscellaneous']
};

interface EditExpenseProps {
  tripId: string;
  participants: User[];
  currentUser: User;
  expense: Expense;
  onExpenseUpdated: () => void;
  onCancel: () => void;
}

export const EditExpense: React.FC<EditExpenseProps> = ({
  tripId,
  participants,
  currentUser,
  expense,
  onExpenseUpdated,
  onCancel
}) => {
  const { updateExpense } = useExpense();
  const [title, setTitle] = useState(expense.title);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [currency, setCurrency] = useState(expense.currency);
  const [date, setDate] = useState(expense.date);
  const [selectedPayer, setSelectedPayer] = useState(expense.paidBy._id);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(expense.splitMethod);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(() => {
    // Initialize with the expense participants' IDs
    return expense.participants.map(p => p.userId);
  });
  const [selectedCategory, setSelectedCategory] = useState(expense.category || '');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [splitWarning, setSplitWarning] = useState<string | null>(null);
  const [participantShares, setParticipantShares] = useState<{ [key: string]: number }>(() => {
    // Initialize with the expense participants' shares
    return expense.participants.reduce((acc, p) => {
      let shareValue = 0;
      if (expense.splitMethod === 'equal') {
        shareValue = expense.amount / expense.participants.length;
      } else if (expense.splitMethod === 'percentage') {
        shareValue = p.splitDetails.percentage?.value || 0;
      } else if (expense.splitMethod === 'shares') {
        shareValue = p.splitDetails.shares?.value || 0;
      } else if (expense.splitMethod === 'custom') {
        shareValue = p.splitDetails.custom?.amount || 0;
      }
      return { ...acc, [p.userId]: shareValue };
    }, {});
  });

  // Update form when expense changes
  useEffect(() => {
    setTitle(expense.title);
    setDescription(expense.description);
    setAmount(expense.amount.toString());
    setCurrency(expense.currency);
    setDate(expense.date);
    setSelectedPayer(expense.paidBy._id);
    setSplitMethod(expense.splitMethod);
    setSelectedParticipants(expense.participants.map(p => p.userId));
    
    // Update participant shares
    setParticipantShares(
      expense.participants.reduce((acc, p) => {
        let shareValue = 0;
        if (expense.splitMethod === 'equal') {
          shareValue = expense.amount / expense.participants.length;
        } else if (expense.splitMethod === 'percentage') {
          shareValue = p.splitDetails.percentage?.value || 0;
        } else if (expense.splitMethod === 'shares') {
          shareValue = p.splitDetails.shares?.value || 0;
        } else if (expense.splitMethod === 'custom') {
          shareValue = p.splitDetails.custom?.amount || 0;
        }
        return { ...acc, [p.userId]: shareValue };
      }, {})
    );
  }, [expense]);

  // Handle category suggestions
  useEffect(() => {
    const suggestion = suggestCategory(title, description);
    if (suggestion && !selectedCategory) {
      setCategorySuggestion(suggestion);
      setShowSuggestion(!!suggestion);
    }
  }, [title, description, selectedCategory]);

  // Set initial category and subcategory
  useEffect(() => {
    if (expense.category) {
      const mainCategory = Object.entries(EXPENSE_CATEGORIES).find(([_, subcategories]) =>
        subcategories.includes(expense.category!)
      );
      if (mainCategory) {
        setSelectedCategory(mainCategory[0]);
        setSelectedSubcategory(expense.category);
      }
    }
  }, [expense.category]);

  // Update shares when split method changes
  useEffect(() => {
    if (splitMethod === 'equal') {
      setParticipantShares({});
    } else if (splitMethod === 'percentage') {
      const equalPercentage = Math.round((100 / selectedParticipants.length) * 10) / 10;
      const shares: { [key: string]: number } = selectedParticipants.reduce(
        (acc, id) => ({ ...acc, [id]: equalPercentage }), 
        {}
      );
      const lastId = selectedParticipants[selectedParticipants.length - 1];
      const total = (Object.values(shares) as number[]).reduce((sum: number, share: number) => sum + share, 0);
      shares[lastId] = Math.round((100 - (total - equalPercentage)) * 10) / 10;
      setParticipantShares(shares);
    } else if (splitMethod === 'shares') {
      setParticipantShares(
        selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: 1 }), {})
      );
    } else {
      const equalAmount = parseFloat(amount) / selectedParticipants.length;
      setParticipantShares(
        selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: equalAmount }), {})
      );
    }
  }, [splitMethod, selectedParticipants, amount]);

  const validateSplits = () => {
    if (splitMethod === 'equal') return true;

    const total = (Object.values(participantShares) as number[]).reduce((sum: number, share: number) => sum + (share || 0), 0);
    
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

    const total = (Object.values(participantShares) as number[]).reduce((sum: number, share: number) => sum + (share || 0), 0);
    
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
    if (!validateSplits()) {
      setSplitWarning('Please ensure the splits are valid');
      return;
    }

    try {
      const updatedExpense = {
        ...expense,
        title,
        description,
        amount: parseFloat(amount),
        currency,
        date,
        paidBy: {
          _id: selectedPayer,
          name: participants.find(p => p._id === selectedPayer)?.name || '',
          email: participants.find(p => p._id === selectedPayer)?.email || '',
          photoUrl: participants.find(p => p._id === selectedPayer)?.photoUrl || null
        },
        splitMethod,
        participants: selectedParticipants.map(userId => {
          const participant = participants.find(p => p._id === userId);
          if (!participant) return null;
          return createParticipantWithSplitDetails(
            participant,
            splitMethod,
            parseFloat(amount),
            selectedParticipants,
            mapUserIdToId(participantShares, participants)
          );
        }).filter((p): p is NonNullable<typeof p> => p !== null),
        category: selectedCategory
      };

      await updateExpense(tripId, expense._id, updatedExpense);
      onExpenseUpdated();
    } catch (error) {
      console.error('Error updating expense:', error);
      setSplitWarning('Failed to update expense. Please try again.');
    }
  };

  const handleShareChange = (participantId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setParticipantShares(prev => ({
      ...prev,
      [participantId]: numValue
    }));
  };

  const handleParticipantToggle = (participantId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(participantId)) {
        return prev.filter(id => id !== participantId);
      } else {
        return [...prev, participantId];
      }
    });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    const suggestion = suggestCategory(newTitle, description);
    setCategorySuggestion(suggestion);
    setShowSuggestion(!!suggestion);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setDescription(newDescription);
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

  const handleSplitMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSplitMethod(e.target.value as SplitMethod);
    setSplitWarning(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={handleTitleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Enter expense title"
        />
        {showSuggestion && categorySuggestion && (
          <div className="mt-2 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Suggested category:</span>
              <button
                type="button"
                onClick={handleApplySuggestion}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {categorySuggestion.mainCategory} → {categorySuggestion.subCategory}
              </button>
              <button
                type="button"
                onClick={() => setShowSuggestion(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={handleDescriptionChange}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="Enter expense description"
        />
      </div>

      <div className="space-y-4">
        {/* Basic Info Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              step="0.01"
              required
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
              <option value="CNY">CNY</option>
              <option value="INR">INR</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Split Method</label>
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

        {/* Category Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Payer Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Paid by</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {participants.map((participant) => (
              <label
                key={participant._id}
                className="flex items-center space-x-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  name="payer"
                  value={participant._id}
                  checked={selectedPayer === participant._id}
                  onChange={() => setSelectedPayer(participant._id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="flex items-center space-x-2">
                  <Avatar
                    photoUrl={participant.photoUrl || null}
                    name={participant.name}
                    size="sm"
                    className="border border-gray-200"
                  />
                  <span className="text-sm text-gray-700">{participant.name}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Participant Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Participants</h3>
          <div className="grid grid-cols-2 gap-4">
            {participants.map(participant => (
              <div
                key={participant._id}
                className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  selectedParticipants.includes(participant._id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedParticipants.includes(participant._id)}
                  onChange={() => handleParticipantToggle(participant._id)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <Avatar
                  photoUrl={participant.photoUrl || null}
                  name={participant.name}
                  size="sm"
                />
                <span className="flex-1">{participant.name}</span>
                {selectedParticipants.includes(participant._id) && (
                  <input
                    type="number"
                    value={participantShares[participant._id] || ''}
                    onChange={(e) => handleShareChange(participant._id, e.target.value)}
                    className="w-20 px-2 py-1 border rounded"
                    placeholder="Share"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Share Inputs */}
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
                    <Avatar
                      photoUrl={participant.photoUrl || null}
                      name={participant.name}
                      size="sm"
                      className="border border-gray-200"
                    />
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

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Changes
          </button>
        </div>
      </div>
    </form>
  );
}; 