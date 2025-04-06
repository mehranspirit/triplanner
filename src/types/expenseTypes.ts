import { User } from './eventTypes';

export type SplitMethod = 'equal' | 'custom' | 'percentage' | 'shares';

export interface SplitDetails {
  equal?: {
    splitCount: number;  // Total number of participants
  };
  percentage?: {
    value: number;  // Original percentage (0-100)
  };
  shares?: {
    value: number;  // Original share count
    totalShares: number;  // Total shares in the split
  };
  custom?: {
    amount: number;  // Original custom amount
  };
}

export interface ExpenseParticipant {
  userId: string;
  name: string;
  share: number;  // Final monetary amount
  splitDetails: SplitDetails;  // Original split information
  settled: boolean;
  photoUrl?: string | null;
}

export interface Expense {
  _id: string;
  tripId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  paidBy: {
    _id: string;
    name: string;
    email: string;
    photoUrl?: string | null;
  };
  splitMethod: SplitMethod;
  participants: ExpenseParticipant[];
  category?: string;
  receipt?: {
    url: string;
    uploadedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Settlement {
  _id: string;
  tripId: string;
  fromUserId: {
    _id: string;
    name: string;
    email: string;
  };
  toUserId: {
    _id: string;
    name: string;
    email: string;
  };
  amount: number;
  currency: string;
  method?: 'cash' | 'bank_transfer' | 'venmo' | 'other';
  status: 'pending' | 'completed';
  date: string;
  notes?: string;
}

export interface ExpenseSummary {
  totalAmount: number;
  perPersonBalances: Record<string, number>;
  unsettledAmount: number;
  currency: string;
}

export interface SettlementMatrix {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed';
} 