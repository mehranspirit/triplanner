import React, { useState } from 'react';
import { ExpenseList } from './ExpenseList';
import { AddExpense } from './AddExpense';
import { ExpenseSummary } from './ExpenseSummary';
import { SettlementManagement } from './SettlementManagement';
import { User } from '../../types/eventTypes';

interface ExpenseDashboardProps {
  tripId: string;
  participants: User[];
  currentUser: User;
}

type Tab = 'summary' | 'expenses' | 'settlements' | 'add';

export const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({
  tripId,
  participants,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'settlements', label: 'Settlements' }
  ];

  return (
    <div className="space-y-6">
      {/* Mobile Navigation */}
      <div className="sm:hidden">
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 rounded-md text-sm ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('add')}
            className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-sm flex items-center justify-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden sm:flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setActiveTab('add')}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center space-x-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>Add Expense</span>
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'summary' && (
          <ExpenseSummary tripId={tripId} participants={participants} />
        )}
        
        {activeTab === 'expenses' && (
          <ExpenseList 
            tripId={tripId} 
            participants={participants}
            currentUser={currentUser}
          />
        )}
        
        {activeTab === 'add' && (
          <AddExpense
            tripId={tripId}
            participants={participants}
            currentUser={currentUser}
            onExpenseAdded={() => setActiveTab('expenses')}
          />
        )}

        {activeTab === 'settlements' && (
          <SettlementManagement
            tripId={tripId}
            participants={participants}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}; 