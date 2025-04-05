import { User } from './eventTypes';

export type SplitMethod = 'equal' | 'custom' | 'percentage' | 'shares';

export interface ExpenseParticipant {
  userId: string;
  name: string;
  share: number;  // Amount or percentage
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
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  method: 'cash' | 'bank_transfer' | 'other';
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