import React, { useRef, useState } from 'react';
import { ExpenseList } from './ExpenseList';
import { AddExpense } from './AddExpense';
import { ExpenseSummary } from './ExpenseSummary';
import { SettlementManagement } from './SettlementManagement';
import { User } from '../../types/eventTypes';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface ExpenseDashboardProps {
  tripId: string;
  participants: User[];
  currentUser: User;
}

type Tab = 'summary' | 'expenses' | 'settlements';

export const ExpenseDashboard: React.FC<ExpenseDashboardProps> = ({
  tripId,
  participants,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const isOnline = useOnlineStatus();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'settlements', label: 'Settle Up' }
  ];

  const renderPanel = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <ExpenseSummary
            tripId={tripId}
            participants={participants}
            currentUser={currentUser}
            onSettleUp={() => setActiveTab('settlements')}
          />
        );
      case 'expenses':
        return (
          <ExpenseList
            tripId={tripId}
            participants={participants}
            currentUser={currentUser}
            onAddExpense={() => setIsAddOpen(true)}
          />
        );
      case 'settlements':
        return (
          <SettlementManagement
            tripId={tripId}
            participants={participants}
            currentUser={currentUser}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black bg-opacity-50 p-0 sm:items-center sm:justify-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsAddOpen(false);
              addButtonRef.current?.focus();
            }
          }}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-3xl sm:rounded-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-expense-title"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
              <div>
                <h2 id="add-expense-title" className="text-lg font-semibold text-gray-900">Add Expense</h2>
                <p className="text-sm text-gray-500">Add the basics first. Details are optional.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  addButtonRef.current?.focus();
                }}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close add expense"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <AddExpense
                tripId={tripId}
                participants={participants}
                currentUser={currentUser}
                onExpenseAdded={() => {
                  setIsAddOpen(false);
                  setActiveTab('expenses');
                  addButtonRef.current?.focus();
                }}
                onCancel={() => {
                  setIsAddOpen(false);
                  addButtonRef.current?.focus();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          You are offline. Expenses and summaries may use cached data and will sync when your connection returns.
        </div>
      )}

      {/* Mobile Navigation */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Expense sections">
            {tabs.map(tab => (
              <button
                key={tab.id}
                id={`expense-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`expense-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={`shrink-0 px-3 py-2 rounded-md text-sm ${
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
            ref={addButtonRef}
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="shrink-0 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Add
          </button>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden sm:flex justify-between items-center">
        <div className="flex items-center space-x-2" role="tablist" aria-label="Expense sections">
          {tabs.map(tab => (
            <button
              key={tab.id}
              id={`expense-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`expense-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
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
          ref={addButtonRef}
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Expense
        </button>
      </div>

      <div
        id={`expense-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`expense-tab-${activeTab}`}
        tabIndex={0}
        className="mt-6"
      >
        {renderPanel()}
      </div>
    </div>
  );
}; 