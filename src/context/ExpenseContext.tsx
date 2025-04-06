import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { Expense, Settlement, ExpenseSummary } from '../types/expenseTypes';

interface ExpenseContextType {
  expenses: Expense[];
  settlements: Settlement[];
  expenseSummary: ExpenseSummary | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  addExpense: (tripId: string, expense: Omit<Expense, '_id'>) => Promise<void>;
  updateExpense: (tripId: string, expenseId: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (tripId: string, expenseId: string) => Promise<void>;
  settleExpense: (tripId: string, expenseId: string, participantId: string) => Promise<void>;
  addSettlement: (tripId: string, settlement: Omit<Settlement, '_id'>) => Promise<void>;
  updateSettlement: (tripId: string, settlementId: string, updates: Partial<Settlement>) => Promise<void>;
  refreshData: (tripId: string) => Promise<void>;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: React.ReactNode; tripId: string }> = ({ children, tripId }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [expenseSummary, setExpenseSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize data when mounted
  useEffect(() => {
    refreshData(tripId);
  }, [tripId]);

  const refreshData = async (tripId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch expenses and settlements
      const [expensesData, settlementsData, summaryData] = await Promise.all([
        api.getExpenses(tripId),
        api.getSettlements(tripId),
        api.getExpenseSummary(tripId)
      ]);

      setExpenses(expensesData);
      setSettlements(settlementsData);
      setExpenseSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expense data');
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (tripId: string, expense: Omit<Expense, '_id'>) => {
    try {
      const newExpense = await api.addExpense(tripId, expense);
      setExpenses(prev => [...prev, newExpense]);
      await refreshData(tripId); // Refresh summary
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add expense');
    }
  };

  const updateExpense = async (tripId: string, expenseId: string, updates: Partial<Expense>) => {
    try {
      const updatedExpense = await api.updateExpense(tripId, expenseId, updates);
      setExpenses(prev => prev.map(exp => 
        exp._id === expenseId ? updatedExpense : exp
      ));
      await refreshData(tripId); // Refresh summary
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update expense');
    }
  };

  const deleteExpense = async (tripId: string, expenseId: string) => {
    try {
      await api.deleteExpense(tripId, expenseId);
      setExpenses(prev => prev.filter(exp => exp._id !== expenseId));
      await refreshData(tripId); // Refresh summary
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete expense');
    }
  };

  const settleExpense = async (tripId: string, expenseId: string, participantId: string) => {
    try {
      await api.settleExpense(tripId, expenseId, participantId);
      await refreshData(tripId); // Refresh all data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to settle expense');
    }
  };

  const addSettlement = async (tripId: string, settlement: Omit<Settlement, '_id'>) => {
    try {
      const newSettlement = await api.addSettlement(tripId, settlement);
      setSettlements(prev => [...prev, newSettlement]);
      await refreshData(tripId); // Refresh summary
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add settlement');
    }
  };

  const updateSettlement = async (tripId: string, settlementId: string, updates: Partial<Settlement>) => {
    try {
      const updatedSettlement = await api.updateSettlement(tripId, settlementId, updates);
      setSettlements(prev => prev.map(sett => 
        sett._id === settlementId ? updatedSettlement : sett
      ));
      await refreshData(tripId); // Refresh summary
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update settlement');
    }
  };

  return (
    <ExpenseContext.Provider value={{
      expenses,
      settlements,
      expenseSummary,
      loading,
      error,
      addExpense,
      updateExpense,
      deleteExpense,
      settleExpense,
      addSettlement,
      updateSettlement,
      refreshData
    }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (context === undefined) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
}; 