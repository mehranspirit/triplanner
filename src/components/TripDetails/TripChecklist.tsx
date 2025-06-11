import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Trash2, Loader2, RefreshCw, AlertCircle, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { debounce } from 'lodash';
import { networkAwareApi } from '../../services/networkAwareApi';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  isEditing?: boolean;
}

interface ChecklistBin {
  id: string;
  title: string;
  items: ChecklistItem[];
}

type Checklist = ChecklistBin[];

interface TripChecklistProps {
  tripId: string;
  canEdit: boolean;
  onClose: () => void;
}

const initialBins: Checklist = [
  { id: crypto.randomUUID(), title: 'To Do', items: [] },
];

// Cache structure with metadata
interface CacheEntry {
  data: Checklist;
  timestamp: number;
  version: number;
}

interface ChecklistCache {
  [tripId: string]: {
    [tab: string]: CacheEntry;
  };
}

// Module-level cache with metadata
const checklistCache: ChecklistCache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = 1;

const TripChecklist: React.FC<TripChecklistProps> = ({ tripId, canEdit, onClose }) => {
  const [bins, setBins] = useState<Checklist>(initialBins);
  const [input, setInput] = useState('');
  const [newBinTitle, setNewBinTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'shared' | 'personal'>('shared');
  const [isSyncing, setIsSyncing] = useState(false);

  // Determine endpoint based on tab
  const endpoint = activeTab === 'shared' ? 'shared' : 'personal';

  // Check if cache is valid
  const isCacheValid = useCallback((entry: CacheEntry | undefined) => {
    if (!entry) return false;
    const now = Date.now();
    return (
      now - entry.timestamp < CACHE_DURATION &&
      entry.version === CACHE_VERSION
    );
  }, []);

  // Clear cache for current trip/tab
  const clearCache = useCallback(() => {
    if (checklistCache[tripId]) {
      delete checklistCache[tripId][endpoint];
    }
  }, [tripId, endpoint]);

  // Fetch bins from backend
  const fetchBins = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first if not forcing refresh
      if (!forceRefresh && checklistCache[tripId]?.[endpoint] && isCacheValid(checklistCache[tripId][endpoint])) {
        setBins(checklistCache[tripId][endpoint].data);
        setLoading(false);
        return;
      }

      const data = await networkAwareApi.getChecklist(tripId, endpoint);
      if (Array.isArray(data)) {
        setBins(data);
        // Update cache
        if (!checklistCache[tripId]) {
          checklistCache[tripId] = {};
        }
        checklistCache[tripId][endpoint] = {
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
      }
    } catch (error) {
      console.error('Error fetching checklist:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch checklist');
      // If we have stale cache data, use it
      if (checklistCache[tripId]?.[endpoint]) {
        setBins(checklistCache[tripId][endpoint].data);
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, endpoint, isCacheValid]);

  // Debounced sync function
  const debouncedSync = useCallback(
    debounce(async (nextBins: Checklist) => {
      setIsSyncing(true);
      try {
        const updatedBins = await networkAwareApi.updateChecklist(tripId, endpoint, nextBins);
        // Update cache on successful sync
        if (!checklistCache[tripId]) {
          checklistCache[tripId] = {};
        }
        checklistCache[tripId][endpoint] = {
          data: updatedBins,
          timestamp: Date.now(),
          version: CACHE_VERSION
        };
      } catch (error) {
        console.error('Error syncing checklist:', error);
        setError(error instanceof Error ? error.message : 'Failed to sync checklist');
        // Refresh data on sync error
        fetchBins(true);
      } finally {
        setIsSyncing(false);
      }
    }, 1000),
    [tripId, endpoint]
  );

  // Sync bins to backend
  const syncBins = useCallback((nextBins: Checklist) => {
    setBins(nextBins);
    debouncedSync(nextBins);
  }, [debouncedSync]);

  // Fetch on mount and tab change
  useEffect(() => {
    fetchBins();
  }, [tripId, endpoint, fetchBins]);

  // Socket.io setup
  useEffect(() => {
    const socket = io();
    socket.on('checklistUpdate', (data) => {
      if (data.tripId === tripId) {
        // Refresh data when receiving updates
        fetchBins(true);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [tripId, fetchBins]);

  // Add a new bin
  const handleAddBin = () => {
    if (!newBinTitle.trim()) return;
    const nextBins = [...bins, { id: crypto.randomUUID(), title: newBinTitle.trim(), items: [] }];
    setNewBinTitle('');
    syncBins(nextBins);
  };

  // Add a new item to a bin
  const handleAddItem = (binId: string) => {
    if (!input.trim()) return;
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? { ...bin, items: [...bin.items, { id: crypto.randomUUID(), text: input.trim(), completed: false }] }
        : bin
    );
    setInput('');
    syncBins(nextBins);
  };

  // Toggle item completed
  const handleToggle = (binId: string, itemId: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? { ...bin, items: bin.items.map(item => item.id === itemId ? { ...item, completed: !item.completed } : item) }
        : bin
    );
    syncBins(nextBins);
  };

  // Delete item
  const handleDeleteItem = (binId: string, itemId: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? { ...bin, items: bin.items.filter(item => item.id !== itemId) }
        : bin
    );
    syncBins(nextBins);
  };

  // Edit bin title
  const handleEditBinTitle = (binId: string, newTitle: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId ? { ...bin, title: newTitle } : bin
    );
    syncBins(nextBins);
  };

  // Delete bin
  const handleDeleteBin = (binId: string) => {
    const nextBins = bins.filter(bin => bin.id !== binId);
    syncBins(nextBins);
  };

  // Handle item edit
  const handleEditItem = (binId: string, itemId: string, newText: string) => {
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? {
            ...bin,
            items: bin.items.map(item =>
              item.id === itemId
                ? { ...item, text: newText, isEditing: false }
                : item
            )
          }
        : bin
    );
    syncBins(nextBins);
  };

  // Toggle item edit mode
  const toggleItemEdit = (binId: string, itemId: string) => {
    if (!canEdit) return;
    const nextBins = bins.map(bin =>
      bin.id === binId
        ? {
            ...bin,
            items: bin.items.map(item =>
              item.id === itemId
                ? { ...item, isEditing: !item.isEditing }
                : { ...item, isEditing: false }
            )
          }
        : bin
    );
    setBins(nextBins);
  };

  // Handle item click
  const handleItemClick = (binId: string, itemId: string) => {
    if (!canEdit) return;
    toggleItemEdit(binId, itemId);
  };

  // Drag and drop logic
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;
    let nextBins = bins;
    if (source.droppableId === destination.droppableId) {
      // Reorder within the same bin
      nextBins = bins.map(bin => {
        if (bin.id !== source.droppableId) return bin;
        const newItems = Array.from(bin.items);
        const [moved] = newItems.splice(source.index, 1);
        newItems.splice(destination.index, 0, moved);
        return { ...bin, items: newItems };
      });
    } else {
      // Move item across bins
      nextBins = bins.map(bin => {
        if (bin.id === source.droppableId) {
          const newItems = Array.from(bin.items);
          newItems.splice(source.index, 1);
          return { ...bin, items: newItems };
        }
        if (bin.id === destination.droppableId) {
          const sourceBin = bins.find(b => b.id === source.droppableId);
          if (!sourceBin) return bin;
          const moved = sourceBin.items[source.index];
          const newItems = Array.from(bin.items);
          newItems.splice(destination.index, 0, moved);
          return { ...bin, items: newItems };
        }
        return bin;
      });
    }
    syncBins(nextBins);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
        <span className="ml-2 text-gray-400">Loading checklist...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white text-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Trip Checklist</h2>
        <div className="flex items-center gap-2">
          {isSyncing && <Loader2 className="h-4 w-4 animate-spin" />}
          <button
            onClick={() => fetchBins(true)}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-2 border-b border-gray-200">
        <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab('shared')}
            className={cn(
              "flex-1 py-1 px-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'shared' ? 'bg-white shadow' : 'hover:bg-gray-200'
            )}
          >
            Shared
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            className={cn(
              "flex-1 py-1 px-2 rounded-md text-sm font-medium transition-colors",
              activeTab === 'personal' ? 'bg-white shadow' : 'hover:bg-gray-200'
            )}
          >
            Personal
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 text-red-800 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={16} />
          </button>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {bins.map((bin, binIndex) => (
            <Droppable key={bin.id} droppableId={bin.id} type="item">
              {(provided) => (
                <div 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="bg-gray-50 p-3 rounded-lg"
                >
                  <div className="flex justify-between items-center mb-2">
                    <Input
                      value={bin.title}
                      onChange={(e) => handleEditBinTitle(bin.id, e.target.value)}
                      disabled={!canEdit}
                      className="text-md font-semibold bg-transparent border-none focus:ring-0 p-0"
                    />
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteBin(bin.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-gray-100"
                        title="Delete List"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  
                  {bin.items.map((item, itemIndex) => (
                    <Draggable key={item.id} draggableId={item.id} index={itemIndex} isDragDisabled={!canEdit}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-100 group"
                        >
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggle(bin.id, item.id)}
                            disabled={!canEdit}
                            className="form-checkbox h-4 w-4 rounded bg-gray-200 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className={cn("flex-grow", item.completed && "line-through text-gray-500")}>
                            {item.text}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteItem(bin.id, item.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100"
                              title="Delete Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}

                  {canEdit && (
                    <form 
                      className="mt-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddItem(bin.id);
                      }}
                    >
                      <Input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="+ Add item"
                        className="w-full bg-transparent border-none focus:ring-0 p-0 placeholder:text-gray-500"
                      />
                    </form>
                  )}
                </div>
              )}
            </Droppable>
          ))}
          {canEdit && (
             <form 
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddBin();
                }}
              >
              <Input
                type="text"
                value={newBinTitle}
                onChange={(e) => setNewBinTitle(e.target.value)}
                placeholder="Add new list..."
                className="flex-grow bg-gray-100 border-gray-300 rounded-md placeholder:text-gray-500"
              />
              <Button type="submit" className="bg-gray-200 hover:bg-gray-300 text-gray-800">Add List</Button>
            </form>
          )}
        </div>
      </DragDropContext>
    </div>
  );
};

export default TripChecklist;
