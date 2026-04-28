import React, { useState } from 'react';
import { useExpense } from '../../context/ExpenseContext';
import { formatCurrency } from '../../utils/format';
import { User } from '../../types/eventTypes';
import Avatar from '../Avatar';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getMainExpenseCategory } from '../../utils/expenseOptions';

interface ExpenseSummaryProps {
  tripId: string;
  participants: User[];
  currentUser: User;
}

// Define colors for different categories
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C43'];

export const ExpenseSummary: React.FC<ExpenseSummaryProps> = ({ tripId, participants, currentUser }) => {
  const { expenseSummary, expenses, loading, error, refreshData } = useExpense();
  const [showChart, setShowChart] = useState(true);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
        Loading expense summary...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">Unable to load expense summary.</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => refreshData(tripId)}
          className="mt-3 text-sm font-medium text-red-800 underline hover:text-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!expenseSummary) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <h3 className="text-base font-semibold text-gray-900">No expense data available</h3>
        <p className="mt-2 text-sm text-gray-600">Add expenses to see totals, categories, and balances.</p>
      </div>
    );
  }

  // Create a map of user IDs to user objects for easy lookup
  const userMap = new Map(participants.map(user => [user._id, user]));

  // Calculate category totals (only main categories)
  const categoryTotals = expenses.reduce((acc, expense) => {
    const category = expense.category || 'Uncategorized';
    const mainCategory = getMainExpenseCategory(category);
    acc[mainCategory] = (acc[mainCategory] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  // Transform category totals into data for the pie chart
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({
    name,
    value
  }));
  const currentUserBalance = expenseSummary.perPersonBalances[currentUser._id] || 0;
  const hasMixedCurrencies = Boolean(expenseSummary.hasMixedCurrencies) || expenseSummary.currency === 'MULTI';
  const currencyTotals = Object.entries(expenseSummary.currencyTotals || {});

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Expense Summary</h2>
      
      <div className="space-y-6">
        {hasMixedCurrencies && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            This trip has expenses in multiple currencies, so totals are shown by currency instead of as one combined amount.
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <span className="text-sm text-gray-600">Total Expenses</span>
            <div className="mt-1 text-xl font-bold text-gray-900">
              {hasMixedCurrencies ? `${currencyTotals.length} currencies` : formatCurrency(expenseSummary.totalAmount, expenseSummary.currency)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <span className="text-sm text-gray-600">Unsettled Amount</span>
            <div className="mt-1 text-xl font-bold text-red-500">
              {hasMixedCurrencies ? 'See balances' : formatCurrency(expenseSummary.unsettledAmount, expenseSummary.currency)}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <span className="text-sm text-gray-600">Expenses</span>
            <div className="mt-1 text-xl font-bold text-gray-900">{expenses.length}</div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <span className="text-sm text-gray-600">Your Net Position</span>
            <div className={`mt-1 text-xl font-bold ${currentUserBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {hasMixedCurrencies ? 'Mixed' : formatCurrency(currentUserBalance, expenseSummary.currency)}
            </div>
          </div>
        </div>

        {hasMixedCurrencies && currencyTotals.length > 0 && (
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700">Totals by Currency</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {currencyTotals.map(([currencyCode, totals]) => (
                <div key={currencyCode} className="flex justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-700">{currencyCode}</span>
                  <span className="text-gray-900">{formatCurrency(totals.totalAmount, currencyCode)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Distribution */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Expense Categories</h3>
            <button
              onClick={() => setShowChart(!showChart)}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
              aria-expanded={showChart}
              aria-controls="expense-category-chart"
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
            <div id="expense-category-chart" className="h-80">
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
                    label={({ name, value }) => `${name}\n${hasMixedCurrencies ? Math.round(value).toString() : formatCurrency(Math.round(value), expenseSummary.currency)}`}
                    style={{ fontSize: '12px', fontWeight: '500' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => hasMixedCurrencies ? value.toFixed(2) : formatCurrency(value, expenseSummary.currency)}
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
          <p className="mb-3 text-sm text-gray-500">
            Positive balances mean the person is owed money. Negative balances mean the person owes money.
          </p>
          <div className="space-y-2">
            {Object.entries(expenseSummary.perPersonBalances).map(([userId, balance]) => {
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
                    {hasMixedCurrencies ? balance.toFixed(2) : formatCurrency(balance, expenseSummary.currency)}
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