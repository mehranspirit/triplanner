export type PrepSuggestionCategory =
  | 'documents'
  | 'packing'
  | 'transport'
  | 'lodging'
  | 'money'
  | 'health'
  | 'offline'
  | 'collaboration';

export interface PrepSuggestion {
  id: string;
  title: string;
  reason: string;
  category: PrepSuggestionCategory;
  scope: 'shared' | 'personal';
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}
