import React, { useState } from 'react';
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

interface AddExpenseProps {
  tripId: string;
  participants: User[];
  currentUser: User;
  onExpenseAdded?: () => void;
}

export const AddExpense: React.FC<AddExpenseProps> = ({ tripId, participants, currentUser, onExpenseAdded }) => {
  const { addExpense } = useExpense();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [participantShares, setParticipantShares] = useState<{ [key: string]: number }>({});
  const [selectedPayer, setSelectedPayer] = useState(currentUser._id);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    participants.map(p => p._id)
  );
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [categorySuggestion, setCategorySuggestion] = useState<CategorySuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [splitWarning, setSplitWarning] = useState<string | null>(null);

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
    
    if (!validateSplits()) {
      const warning = getSplitWarning();
      if (warning) {
        alert(warning);
        return;
      }
    }

    const payer = participants.find(p => p._id === selectedPayer);
    if (!payer) {
      alert('Selected payer not found');
      return;
    }

    const expenseAmount = parseFloat(amount);
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
      await addExpense(tripId, expense);
      console.log('Expense added successfully');
      
      // Reset form
      setTitle('');
      setDescription('');
      setAmount('');
      setDate(new Date().toISOString().split('T')[0]);
      setSplitMethod('equal');
      setParticipantShares({});
      setSelectedPayer(currentUser._id);
      setSelectedParticipants(participants.map(p => p._id));
      setSelectedCategory('');
      setSelectedSubcategory('');
      
      if (onExpenseAdded) {
        onExpenseAdded();
      }
    } catch (error) {
      console.error('Failed to add expense:', error);
      alert('Failed to add expense. Please try again.');
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
      const equalAmount = parseFloat(amount) / numParticipants;
      setParticipantShares(
        selectedParticipants.reduce((acc, id) => ({ ...acc, [id]: equalAmount }), {})
      );
    }
  };

  // Add console logging to track payer selection
  const handlePayerChange = (payerId: string) => {
    console.log('Changing payer to:', payerId);
    console.log('Selected from participants:', participants.find(p => p._id === payerId));
    setSelectedPayer(payerId);
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
                  onChange={() => handlePayerChange(participant._id)}
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

        {/* Participants Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Split between</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {participants.map((participant) => (
              <label
                key={participant._id}
                className="flex items-center space-x-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedParticipants.includes(participant._id)}
                  onChange={() => handleParticipantToggle(participant._id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
            onClick={onExpenseAdded}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Add Expense
          </button>
        </div>
      </div>
    </form>
  );
}; 