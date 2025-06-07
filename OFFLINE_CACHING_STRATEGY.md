# TripPlanner Offline Caching Strategy

## Overview

This document outlines the comprehensive caching strategy implemented in TripPlanner to ensure robust offline functionality with optimal performance and storage efficiency.

## Multi-Layer Caching Architecture

### 1. Service Worker Cache (PWA Layer)
**Location**: Browser's Service Worker cache
**Purpose**: Network request interception and response caching
**Scope**: HTTP requests, static assets, API responses

#### Cache Strategies by Resource Type

- **Trips API**: Network First with 10s timeout, 24h background sync
- **Expenses API**: Network First with 8s timeout for financial data
- **Settlements API**: Network First with 8s timeout for payment tracking
- **Notes API**: Network First with 8s timeout for collaborative editing
- **Static Assets**: Cache First for images (30 days), fonts (1 year)
- **CSS/JS**: Stale While Revalidate for quick loading (7 days)

### 2. IndexedDB Storage (Application Layer)
**Location**: Browser's IndexedDB
**Purpose**: Structured data storage with offline access
**Scope**: Application data, sync queue, metadata

#### Database Schema

```typescript
interface TripPlannerDB {
  trips: Trip & { lastSync: number }
  events: Event & { tripId: string; lastSync: number }
  expenses: Expense & { lastSync: number }
  settlements: Settlement & { lastSync: number }
  expenseSummaries: ExpenseSummary & { tripId: string; lastSync: number }
  notes: TripNote & { tripId: string; lastSync: number }
  checklists: ChecklistData & { lastSync: number }
  syncQueue: SyncOperation
  metadata: { key: string; value: any; timestamp: number }
}
```

#### Cache Operations by Data Type

##### **Trips**
```typescript
// Cache all trips with timestamp
async cacheTrips(trips: Trip[]): Promise<void>

// Get cached trips for offline access
async getCachedTrips(): Promise<Trip[]>

// Update single trip with optimistic updates
async updateCachedTrip(trip: Trip): Promise<void>

// Clean removal with cascade delete
async deleteCachedTrip(tripId: string): Promise<void>
```

##### **Expenses & Financial Data**
```typescript
// Batch cache expenses for trip
async cacheExpenses(tripId: string, expenses: Expense[]): Promise<void>

// Cache settlements with trip association
async cacheSettlements(tripId: string, settlements: Settlement[]): Promise<void>

// Cache expense summaries for quick balance access
async cacheExpenseSummary(tripId: string, summary: ExpenseSummary): Promise<void>

// Optimized batch updates for performance
async batchUpdateExpenses(tripId: string, expenses: Expense[]): Promise<void>
async batchUpdateSettlements(tripId: string, settlements: Settlement[]): Promise<void>
```

##### **Events**
```typescript
// Cache events with trip association
async cacheEvents(tripId: string, events: Event[]): Promise<void>

// Optimistic event updates
async updateCachedEvent(tripId: string, event: Event): Promise<void>

// Clean event removal
async deleteCachedEvent(eventId: string): Promise<void>
```

##### **Notes & Checklists**
```typescript
// Cache trip notes with timestamp
async cacheNotes(tripId: string, notes: TripNote): Promise<void>

// Cache checklists by type (shared/personal)
async cacheChecklist(tripId: string, type: 'shared' | 'personal', bins: ChecklistBin[]): Promise<void>

// Real-time updates for collaboration
async updateCachedNotes(tripId: string, notes: TripNote): Promise<void>
async updateCachedChecklist(tripId: string, type: string, bins: ChecklistBin[]): Promise<void>
```

### 3. Sync Queue Management
**Purpose**: Track offline operations for later synchronization
**Features**: Retry logic, operation ordering, conflict resolution

```typescript
interface SyncOperation {
  id?: number
  type: 'CREATE_TRIP' | 'UPDATE_TRIP' | 'DELETE_TRIP' | 
        'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT' |
        'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'DELETE_EXPENSE' | 'SETTLE_EXPENSE' |
        'CREATE_SETTLEMENT' | 'UPDATE_SETTLEMENT' |
        'UPDATE_NOTES' | 'UPDATE_CHECKLIST'
  data: any
  timestamp: number
  tripId?: string
  retryCount: number
}
```

## Caching Strategies by Use Case

### 1. **Online-First (Network First)**
**When**: Real-time data critical (expenses, settlements, notes)
**Strategy**: Try network first, fallback to cache
**Benefits**: Always fresh data when online
**Fallback**: Cached data with offline indicator

```typescript
async getExpenses(tripId: string): Promise<Expense[]> {
  if (this.isOnline) {
    try {
      const expenses = await api.getExpenses(tripId)
      await offlineService.cacheExpenses(tripId, expenses)
      return expenses
    } catch (error) {
      return await offlineService.getCachedExpenses(tripId)
    }
  } else {
    return await offlineService.getCachedExpenses(tripId)
  }
}
```

### 2. **Optimistic Updates**
**When**: User interactions requiring immediate feedback
**Strategy**: Update UI immediately, sync in background
**Benefits**: Responsive UI, better UX
**Use Case**: Adding expenses, updating notes, checking items

```typescript
async addExpense(tripId: string, expenseData: Expense): Promise<Expense> {
  // Generate temporary ID for immediate UI update
  const tempExpense = { ...expenseData, _id: `temp-${Date.now()}` }
  
  // Update cache immediately for optimistic UI
  await offlineService.updateCachedExpense(tripId, tempExpense)
  
  if (this.isOnline) {
    try {
      const realExpense = await api.addExpense(tripId, expenseData)
      await offlineService.updateCachedExpense(tripId, realExpense)
      return realExpense
    } catch (error) {
      await offlineService.addToSyncQueue({
        type: 'CREATE_EXPENSE',
        data: expenseData,
        tripId,
        timestamp: Date.now(),
        retryCount: 0
      })
      return tempExpense
    }
  } else {
    await offlineService.addToSyncQueue({
      type: 'CREATE_EXPENSE',
      data: expenseData,
      tripId,
      timestamp: Date.now(),
      retryCount: 0
    })
    return tempExpense
  }
}
```

### 3. **Batch Operations**
**When**: Multiple related operations
**Strategy**: Group operations for efficiency
**Benefits**: Reduced network calls, better performance
**Use Case**: Expense imports, bulk settlements

## Cache Management Features

### 1. **Smart Cache Management**
- **Expired Cache Cleanup**: Automatic removal of old data (7 days default)
- **Orphaned Data Cleanup**: Remove data without parent references
- **Cache Validation**: Integrity checks with issue reporting
- **Comprehensive Statistics**: Detailed cache usage metrics

```typescript
// Expire old cache entries automatically
async clearExpiredCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void>

// Clean orphaned data (events/expenses without parent trip)
async cleanupOrphanedData(): Promise<number>

// Validate cache integrity and report issues
async validateCache(): Promise<{ isValid: boolean; issues: string[] }>

// Comprehensive cache statistics
async getCacheStats(): Promise<CacheStatistics>
```

### 2. **Performance Optimization**
- **Preload Critical Data**: Background loading for offline access
- **Smart Refresh**: Only refresh stale data based on timestamps
- **Cache Warming**: Background loading of recent trips
- **Batch Updates**: Efficient bulk operations

```typescript
// Preload critical data for offline access
async preloadCriticalData(tripIds: string[] = []): Promise<void>

// Smart refresh only stale data
async smartRefresh(tripId: string, maxAge: number = 5 * 60 * 1000): Promise<void>

// Background cache warming
async warmCache(): Promise<void>

// Batch operations for better performance
async batchUpdateExpenses(tripId: string, expenses: Expense[]): Promise<void>
```

### 3. **Storage Management**
- **Storage Monitoring**: Track usage against browser quotas
- **Automatic Optimization**: Database cleanup and defragmentation
- **Manual Cache Control**: User-triggered cache clearing
- **Storage Statistics**: Detailed breakdown by data type

```typescript
// Monitor storage usage
async getStorageSize(): Promise<{ used: number; quota: number }>

// Automatic cleanup when storage is full
async optimizeDatabase(): Promise<void>

// Manual cache clearing for troubleshooting
async clearCache(): Promise<void>
```

## Cache Invalidation Strategy

### **Time-Based Invalidation**
- **Expenses**: 5 minutes (real-time financial data)
- **Settlements**: 5 minutes (payment tracking)
- **Notes**: 1 minute (collaborative editing)
- **Events**: 30 minutes (moderate update frequency)
- **Trips**: 1 hour (general trip info)

### **Event-Based Invalidation**
- **User Actions**: Immediate cache update with optimistic UI
- **Network Reconnection**: Smart refresh of stale data only
- **Sync Completion**: Cache refresh with latest server data
- **Error Conditions**: Graceful fallback to cached data

### **Manual Invalidation**
- **Force Sync**: User-triggered cache refresh
- **Cache Clear**: Development/troubleshooting
- **Storage Optimization**: Automatic cleanup

## Sync Queue Management

### **Operation Types Supported**
```typescript
type SyncOperationType = 
  | 'CREATE_TRIP' | 'UPDATE_TRIP' | 'DELETE_TRIP'
  | 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT'  
  | 'CREATE_EXPENSE' | 'UPDATE_EXPENSE' | 'DELETE_EXPENSE' | 'SETTLE_EXPENSE'
  | 'CREATE_SETTLEMENT' | 'UPDATE_SETTLEMENT'
  | 'UPDATE_NOTES' | 'UPDATE_CHECKLIST'
```

### **Retry Logic**
- **Max Retries**: 3 attempts per operation
- **Backoff Strategy**: Exponential backoff with jitter
- **Failure Handling**: Remove from queue after max retries
- **User Notification**: Clear error messages and manual retry options

## Advanced Caching Features

### **Preloading Strategy**
```typescript
// Preload all data for specific trips
await networkAwareApi.preloadCriticalData(['trip1', 'trip2'])

// Warm cache with recent trips in background  
await networkAwareApi.warmCache()

// Smart refresh only stale data
await networkAwareApi.smartRefresh(tripId, maxAge)
```

### **Cache Statistics**
```typescript
const stats = await networkAwareApi.getCacheStatistics()
// Returns: totalRecords, byStore, storageUsed, lastSyncTimes, pendingSyncOps
```

### **Storage Optimization**
```typescript
// Clear expired cache (7 days default)
await networkAwareApi.clearExpiredCache(maxAgeInDays)

// Full database optimization
await networkAwareApi.optimizeStorage()

// Validate cache integrity  
const validation = await networkAwareApi.validateCacheIntegrity()
```

## Performance Optimizations

### **Network Efficiency**
- **Request Deduplication**: Prevent duplicate simultaneous requests
- **Batch API Calls**: Group related operations
- **Background Sync**: Non-blocking synchronization
- **Smart Timeouts**: Appropriate timeouts per data type

### **Storage Efficiency**
- **Data Compression**: Minimize storage footprint
- **Index Optimization**: Fast data retrieval
- **Garbage Collection**: Automatic cleanup of unused data
- **Efficient Queries**: Optimized database operations

### **Memory Management**
- **Lazy Loading**: Load data as needed
- **Cache Limits**: Prevent excessive memory usage
- **Object Pooling**: Reuse expensive objects
- **Memory Monitoring**: Track usage patterns

## Security & Privacy

### **Data Protection**
- **Local Encryption**: Sensitive data encrypted in IndexedDB
- **Secure Sync**: HTTPS-only communication
- **Access Control**: User-specific data isolation
- **Data Validation**: Integrity checks on sync

### **Privacy Compliance**
- **Data Retention**: Configurable cache expiration
- **Logout Cleanup**: Clear all cached data on logout
- **Incognito Support**: Appropriate private browsing handling
- **User Control**: Manual cache management options

## Monitoring & Debugging

### **Development Tools**
- **Cache Inspector**: Browser DevTools integration
- **Network Monitoring**: API call tracking and cache hit rates
- **Performance Profiling**: Operation timing analysis
- **Error Tracking**: Comprehensive logging and reporting

### **Production Monitoring**
- **Cache Hit Rates**: Target >90% for frequently accessed data
- **Storage Usage**: Monitor against browser quotas
- **Sync Performance**: Track operation success rates
- **Error Rates**: Monitor and alert on failures

This comprehensive caching strategy ensures TripPlanner provides a seamless offline experience with optimal performance, efficient storage usage, and robust data synchronization capabilities across all expense management operations. 