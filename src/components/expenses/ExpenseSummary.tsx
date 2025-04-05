import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { formatCurrency } from '../../utils/format';
import { User } from '../../types/eventTypes';
import Avatar from '../Avatar';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ExpenseSummaryProps {
  tripId: string;
  participants: User[];
}

// Define colors for different categories
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C43'];

// Define expense categories
const EXPENSE_CATEGORIES = {
  'Transportation': ['Flights', 'Trains', 'Buses', 'Taxis/Rideshares', 'Car Rental', 'Fuel', 'Parking'],
  'Accommodation': ['Hotels', 'Hostels', 'Airbnb', 'Camping', 'Other Lodging'],
  'Food & Drinks': ['Restaurants', 'Cafes', 'Groceries', 'Street Food', 'Bars', 'Snacks'],
  'Activities & Entertainment': ['Museums', 'Tours', 'Attractions', 'Shows', 'Sports', 'Recreation'],
  'Shopping': ['Souvenirs', 'Clothes', 'Electronics', 'Gifts', 'Other Items'],
  'Utilities & Services': ['Internet', 'Phone', 'Laundry', 'Cleaning', 'Other Services'],
  'Health & Medical': ['Medicine', 'Insurance', 'Medical Services', 'First Aid'],
  'Other': ['Tips', 'Fees', 'Emergency', 'Miscellaneous']
};

export const ExpenseSummary: React.FC<ExpenseSummaryProps> = ({ tripId, participants }) => {
  const { summary, expenses, loading, error } = useExpense();
  const [showChart, setShowChart] = useState(true);

  if (loading) return <div>Loading summary...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  // Create a map of user IDs to user objects for easy lookup
  const userMap = new Map(participants.map(user => [user._id, user]));

  // Calculate category totals (only main categories)
  const categoryTotals = expenses.reduce((acc, expense) => {
    const category = expense.category || 'Uncategorized';
    // Find the main category for this expense
    let mainCategory = 'Other';
    for (const [mainCat, subCats] of Object.entries(EXPENSE_CATEGORIES)) {
      if (subCats.includes(category)) {
        mainCategory = mainCat;
        break;
      }
    }
    acc[mainCategory] = (acc[mainCategory] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  // Transform category totals into data for the pie chart
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Expense Summary</h2>
      
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Expenses</span>
            <span className="text-xl font-bold">
              {formatCurrency(summary.totalAmount, summary.currency)}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Unsettled Amount</span>
            <span className="text-xl font-bold text-red-500">
              {formatCurrency(summary.unsettledAmount, summary.currency)}
            </span>
          </div>
        </div>

        {/* Category Distribution */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Expense Categories</h3>
            <button
              onClick={() => setShowChart(!showChart)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
            >
              <span>{showChart ? 'Hide Chart' : 'Show Chart'}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 transform transition-transform ${showChart ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          {showChart && (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}\n${formatCurrency(Math.round(value), summary.currency)}`}
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value, summary.currency)}
                    labelStyle={{ color: '#374151' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Per Person Balances */}
        <div>
          <h3 className="text-lg font-medium mb-4">Per Person Balances</h3>
          <div className="space-y-2">
            {Object.entries(summary.perPersonBalances).map(([userId, balance]) => {
              const user = userMap.get(userId);
              if (!user) return null;
              
              return (
                <div key={userId} className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <Avatar 
                      photoUrl={user.photoUrl || null}
                      name={user.name}
                      size="sm"
                      className="border border-gray-200"
                    />
                    <span className="text-gray-600">{user.name}</span>
                  </div>
                  <span className={balance >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {formatCurrency(balance, summary.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}; 