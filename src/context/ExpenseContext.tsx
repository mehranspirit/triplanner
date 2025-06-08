import * as React from 'react';
import { api } from '../services/api';
import { networkAwareApi } from '../services/networkAwareApi';
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
  deleteSettlement: (tripId: string, settlementId: string) => Promise<void>;
  refreshData: (tripId: string) => Promise<void>;
}

const ExpenseContext = React.createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: React.ReactNode; tripId: string }> = ({ children, tripId }) => {
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [settlements, setSettlements] = React.useState<Settlement[]>([]);
  const [expenseSummary, setExpenseSummary] = React.useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize data when mounted
  React.useEffect(() => {
    refreshData(tripId);
  }, [tripId]);

  const refreshData = async (tripId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch expenses (always available offline)
      const expensesData = await networkAwareApi.getExpenses(tripId);
      setExpenses(expensesData);

      // Try to fetch settlements (online only)
      try {
        const settlementsData = await networkAwareApi.getSettlements(tripId);
        setSettlements(settlementsData);
      } catch (settlementError) {
        // If settlements fail (offline), set empty array
        setSettlements([]);
      }

      // Fetch the summary
      const summaryData = await networkAwareApi.getExpenseSummary(tripId);
      setExpenseSummary(summaryData || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expense data');
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (tripId: string, expense: Omit<Expense, '_id'>) => {
    try {
      const newExpense = await networkAwareApi.addExpense(tripId, expense);
      setExpenses(prev => [...prev, newExpense]);
      
      // Refresh summary immediately to reflect changes
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      setExpenseSummary(updatedSummary || null);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add expense');
    }
  };

  const updateExpense = async (tripId: string, expenseId: string, updates: Partial<Expense>) => {
    try {
      const updatedExpense = await networkAwareApi.updateExpense(tripId, expenseId, updates);
      setExpenses(prev => prev.map(exp => 
        exp._id === expenseId ? updatedExpense : exp
      ));
      
      // Refresh summary immediately to reflect changes
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      setExpenseSummary(updatedSummary || null);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update expense');
    }
  };

  const deleteExpense = async (tripId: string, expenseId: string) => {
    try {
      await networkAwareApi.deleteExpense(tripId, expenseId);
      setExpenses(prev => prev.filter(exp => exp._id !== expenseId));
      
      // Refresh summary immediately to reflect changes
      const updatedSummary = await networkAwareApi.getExpenseSummary(tripId);
      setExpenseSummary(updatedSummary || null);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete expense');
    }
  };

  const settleExpense = async (tripId: string, expenseId: string, participantId: string) => {
    try {
      await networkAwareApi.settleExpense(tripId, expenseId, participantId);
      
      // Refresh all data including summary
      await refreshData(tripId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to settle expense');
    }
  };

  const addSettlement = async (tripId: string, settlement: Omit<Settlement, '_id'>) => {
    try {
      await networkAwareApi.addSettlement(tripId, settlement);
      
      // Refresh all data to reflect settlement changes
      await refreshData(tripId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to add settlement');
    }
  };

  const updateSettlement = async (tripId: string, settlementId: string, updates: Partial<Settlement>) => {
    try {
      await networkAwareApi.updateSettlement(tripId, settlementId, updates);
      
      // Refresh all data to reflect settlement changes
      await refreshData(tripId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update settlement');
    }
  };

  const deleteSettlement = async (tripId: string, settlementId: string) => {
    try {
      await networkAwareApi.deleteSettlement(tripId, settlementId);
      
      // Refresh all data to reflect settlement changes
      await refreshData(tripId);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete settlement');
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
      deleteSettlement,
      refreshData
    }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = React.useContext(ExpenseContext);
  if (context === undefined) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
}; 