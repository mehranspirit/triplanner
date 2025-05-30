import React, { useState, useEffect } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { Expense, SplitMethod, SplitDetails } from '../../types/expenseTypes';
import { User } from '../../types/eventTypes';
import Avatar from '../Avatar';
import { suggestCategory, CategorySuggestion } from '../../utils/categorySuggestions';
import { createParticipantWithSplitDetails } from '../../utils/expenseUtils';

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
  expense: Expense;
  participants: User[];
  currentUser: User;
  onExpenseUpdated?: () => void;
  onCancel?: () => void;
}

export const EditExpense: React.FC<EditExpenseProps> = ({
  tripId,
  expense,
  participants,
  currentUser,
  onExpenseUpdated,
  onCancel
}) => {
  // Add debug logging
  console.log('EditExpense props:', {
    expense,
    participants,
    currentUser,
    expenseParticipants: expense.participants
  });

  const { updateExpense } = useExpense();
  const [title, setTitle] = useState(expense.title);
  const [description, setDescription] = useState(expense.description);
  const [amount, setAmount] = useState(expense.amount.toString());
  const [currency, setCurrency] = useState(expense.currency);
  const [date, setDate] = useState(expense.date.split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(expense.splitMethod);
  const [selectedPayer, setSelectedPayer] = useState(expense.paidBy._id);
  
  // Initialize with empty arrays/objects
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [participantShares, setParticipantShares] = useState<{ [key: string]: number }>({});

  // Find the main category for the expense's subcategory
  const findMainCategory = (subcategory: string): string => {
    for (const [mainCat, subCats] of Object.entries(EXPENSE_CATEGORIES)) {
      if (subCats.includes(subcategory)) {
        return mainCat;
      }
    }
    return '';
  };

  const [selectedCategory, setSelectedCategory] = useState(() => {
    if (!expense.category) return '';
    return findMainCategory(expense.category);
  });
  const [selectedSubcategory, setSelectedSubcategory] = useState(expense.category || '');

  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [splitWarning, setSplitWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    setIsSaving(true);

    try {
      // Validate splits
      if (!validateSplits()) {
        setSplitWarning(getSplitWarning());
        return;
      }

      // Create participants array with split details
      const updatedParticipants = selectedParticipants.map(userId => {
        const user = participants.find(p => p._id === userId);
        if (!user) throw new Error('User not found');

        return createParticipantWithSplitDetails(
          user,
          splitMethod,
          parseFloat(amount),
          selectedParticipants,
          participantShares
        );
      });

      // Find the payer
      const payer = participants.find(p => p._id === selectedPayer);
      if (!payer) throw new Error('Selected payer not found');

      // Create the updated expense object
      const updatedExpense: Partial<Expense> = {
        title,
        description,
        amount: parseFloat(amount),
        currency,
        date,
        paidBy: {
          _id: payer._id,
          name: payer.name,
          email: payer.email,
          photoUrl: payer.photoUrl
        },
        splitMethod,
        participants: updatedParticipants,
        category: selectedSubcategory || selectedCategory
      };

      await updateExpense(tripId, expense._id, updatedExpense);
      onExpenseUpdated?.();
    } catch (error) {
      console.error('Failed to update expense:', error);
      alert('Failed to update expense. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // Get suggestion when title changes
    const suggestion = suggestCategory(newTitle, description);
    setCategorySuggestion(suggestion);
    setShowSuggestion(!!suggestion);
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

  // Initialize participant shares from the expense data
  useEffect(() => {
    console.log('Initializing from expense:', {
      expenseParticipants: expense.participants,
      splitMethod: expense.splitMethod,
      amount
    });

    // First, ensure we have the correct selected participants - just their IDs
    const initialSelectedParticipants = expense.participants.map(p => {
      // Handle both populated and unpopulated user objects
      const userId = typeof p.userId === 'object' && p.userId !== null ? (p.userId as User)._id : p.userId;
      return userId;
    });
    console.log('Setting initial selected participants:', initialSelectedParticipants);
    setSelectedParticipants(initialSelectedParticipants);

    // Then initialize the shares using the userId as the key
    const initialShares: { [key: string]: number } = {};
    expense.participants.forEach(participant => {
      // Handle both populated and unpopulated user objects
      const userId = typeof participant.userId === 'object' && participant.userId !== null ? (participant.userId as User)._id : participant.userId;
      // Use the original split details based on the split method
      if (expense.splitMethod === 'equal') {
        initialShares[userId] = parseFloat(amount) / expense.participants.length;
      } else if (expense.splitMethod === 'percentage') {
        // For percentages, use the original percentage value from splitDetails
        initialShares[userId] = participant.splitDetails.percentage?.value || 0;
      } else if (expense.splitMethod === 'shares') {
        initialShares[userId] = participant.splitDetails.shares?.value || 0;
      } else if (expense.splitMethod === 'custom') {
        initialShares[userId] = participant.splitDetails.custom?.amount || 0;
      }
    });

    // For percentage splits, ensure the total is exactly 100%
    if (expense.splitMethod === 'percentage') {
      const total = Object.values(initialShares).reduce((sum, share) => sum + (share || 0), 0);
      if (Math.abs(total - 100) > 0.1) {
        // If total is not 100%, adjust the last participant's share
        const lastId = initialSelectedParticipants[initialSelectedParticipants.length - 1];
        const otherTotal = Object.entries(initialShares)
          .filter(([id]) => id !== lastId)
          .reduce((sum, [_, share]) => sum + (share || 0), 0);
        initialShares[lastId] = Math.round((100 - otherTotal) * 10) / 10;
      }
    }

    console.log('Calculated initial shares:', initialShares);
    setParticipantShares(initialShares);
  }, [expense]); // Remove amount from dependencies to prevent recalculation

  // Add debug logging for participant rendering
  console.log('Rendering participants:', {
    participants: participants.map(p => ({ id: p._id, name: p.name })),
    selectedParticipants: selectedParticipants,
    participantShares: Object.entries(participantShares).map(([id, share]) => ({ id, share }))
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Edit Expense</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          rows={3}
        />
      </div>

      {/* Amount and Currency */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            min="0"
            step="0.01"
            required
          />
        </div>
        <div>
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
          </select>
        </div>
      </div>

      {/* Date */}
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

      {/* Category Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setSelectedSubcategory(''); // Reset subcategory when main category changes
            }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
          >
            <option value="">Select a category</option>
            {Object.keys(EXPENSE_CATEGORIES).map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {selectedCategory && EXPENSE_CATEGORIES[selectedCategory] && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
            <select
              value={selectedSubcategory}
              onChange={(e) => setSelectedSubcategory(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            >
              <option value="">Select a subcategory</option>
              {EXPENSE_CATEGORIES[selectedCategory].map(subcategory => (
                <option key={subcategory} value={subcategory}>{subcategory}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Payer Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
        <select
          value={selectedPayer}
          onChange={(e) => setSelectedPayer(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        >
          {participants.map(participant => (
            <option key={participant._id} value={participant._id}>
              {participant.name}
            </option>
          ))}
        </select>
      </div>

      {/* Split Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Split Method</label>
        <select
          value={splitMethod}
          onChange={(e) => {
            const newSplitMethod = e.target.value as SplitMethod;
            setSplitMethod(newSplitMethod);
            setSplitWarning(null); // Clear warning when changing split method
            
            // Reset shares when changing split method
            const numParticipants = selectedParticipants.length;
            if (numParticipants === 0) return;

            if (newSplitMethod === 'equal') {
              // Calculate equal share for each participant
              const equalShare = parseFloat(amount) / numParticipants;
              const newShares: { [key: string]: number } = {};
              selectedParticipants.forEach(id => {
                newShares[id] = equalShare;
              });
              console.log('Recalculated shares for equal split:', newShares);
              setParticipantShares(newShares);
            } else if (newSplitMethod === 'percentage') {
              // Round to 1 decimal place for percentages
              const equalPercentage = Math.round((100 / numParticipants) * 10) / 10;
              const shares: { [key: string]: number } = {};
              
              // Set equal percentage for all except the last participant
              selectedParticipants.forEach((id, index) => {
                if (index < numParticipants - 1) {
                  shares[id] = equalPercentage;
                }
              });
              
              // Set the last participant's share to make total 100%
              const lastId = selectedParticipants[numParticipants - 1];
              const otherTotal = Object.values(shares).reduce((sum, share) => sum + share, 0);
              shares[lastId] = Math.round((100 - otherTotal) * 10) / 10;
              
              console.log('Recalculated shares for percentage split:', shares);
              setParticipantShares(shares);
            } else if (newSplitMethod === 'shares') {
              setParticipantShares(
                selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: 1 }), {})
              );
            } else if (newSplitMethod === 'custom') {
              const equalAmount = parseFloat(amount) / numParticipants;
              setParticipantShares(
                selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: equalAmount }), {})
              );
            }
          }}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
        >
          <option value="equal">Equal</option>
          <option value="percentage">Percentage</option>
          <option value="shares">Shares</option>
          <option value="custom">Custom Amount</option>
        </select>
      </div>

      {/* Participants and Split Details */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
        <div className="space-y-2">
          {participants.map(participant => {
            const isSelected = selectedParticipants.includes(participant._id);
            const share = participantShares[participant._id] || 0;
            console.log('Rendering participant:', {
              participantId: participant._id,
              isSelected,
              share,
              selectedParticipants
            });
            return (
              <div key={participant._id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const newSelected = e.target.checked
                        ? [...selectedParticipants, participant._id]
                        : selectedParticipants.filter(id => id !== participant._id);
                      console.log('Updating selected participants:', {
                        participantId: participant._id,
                        checked: e.target.checked,
                        newSelected
                      });
                      setSelectedParticipants(newSelected);

                      // Recalculate shares based on split method
                      const numSelected = newSelected.length;
                      if (numSelected === 0) {
                        setParticipantShares({});
                        return;
                      }

                      if (splitMethod === 'equal') {
                        // Calculate equal share for each participant
                        const equalShare = parseFloat(amount) / numSelected;
                        const newShares: { [key: string]: number } = {};
                        newSelected.forEach(id => {
                          newShares[id] = equalShare;
                        });
                        console.log('Recalculated shares for equal split:', newShares);
                        setParticipantShares(newShares);
                      } else if (splitMethod === 'percentage') {
                        // Calculate equal percentage for all selected participants
                        const equalPercentage = Math.round((100 / numSelected) * 10) / 10;
                        const newShares: { [key: string]: number } = {};
                        
                        // Set equal percentage for all except the last participant
                        newSelected.forEach((id, index) => {
                          if (index < numSelected - 1) {
                            newShares[id] = equalPercentage;
                          }
                        });
                        
                        // Set the last participant's share to make total 100%
                        const lastId = newSelected[numSelected - 1];
                        const otherTotal = Object.values(newShares).reduce((sum, share) => sum + share, 0);
                        newShares[lastId] = Math.round((100 - otherTotal) * 10) / 10;
                        
                        console.log('Recalculated shares after participant toggle:', newShares);
                        setParticipantShares(newShares);
                      } else if (splitMethod === 'shares') {
                        setParticipantShares(
                          newSelected.reduce((acc, id) => ({ ...acc, [id]: 1 }), {})
                        );
                      } else if (splitMethod === 'custom') {
                        const equalAmount = parseFloat(amount) / numSelected;
                        setParticipantShares(
                          newSelected.reduce((acc, id) => ({ ...acc, [id]: equalAmount }), {})
                        );
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{participant.name}</span>
                </div>
                {isSelected && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={share}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        const newShares = {
                          ...participantShares,
                          [participant._id]: isNaN(value) ? 0 : value
                        };
                        console.log('Updating participant share:', {
                          participantId: participant._id,
                          oldShare: share,
                          newShare: value,
                          newShares
                        });
                        setParticipantShares(newShares);
                      }}
                      className="w-24 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      min="0"
                      step={splitMethod === 'percentage' ? '1' : '0.01'}
                    />
                    <span className="text-sm text-gray-500">
                      {splitMethod === 'percentage' ? '%' : currency}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {splitWarning && (
        <div className="text-red-500 text-sm">{splitWarning}</div>
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
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}; 