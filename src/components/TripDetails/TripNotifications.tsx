import React from 'react';
import { AlertCircle, Bell, CheckCircle2, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { NotificationPreference, NotificationType, TripNotification } from '@/types/notificationTypes';
import { cn } from '@/lib/utils';

interface TripNotificationsProps {
  notifications: TripNotification[];
  preferences: NotificationPreference | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onMarkRead: (notification: TripNotification) => void;
  onDismiss: (notification: TripNotification) => void;
  onAction: (notification: TripNotification) => void;
  onUpdatePreferences: (preferences: Partial<Pick<NotificationPreference, 'inAppEnabled' | 'disabledTypes'>>) => void;
}

const severityStyles: Record<TripNotification['severity'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

const TripNotifications: React.FC<TripNotificationsProps> = ({
  notifications,
  preferences,
  loading,
  error,
  onClose,
  onRefresh,
  onMarkRead,
  onDismiss,
  onAction,
  onUpdatePreferences,
}) => {
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const disabledTypes = new Set(preferences?.disabledTypes || []);
  const toggleDisabledType = (type: NotificationType, enabled: boolean) => {
    const nextDisabledTypes = new Set(disabledTypes);
    if (enabled) {
      nextDisabledTypes.delete(type);
    } else {
      nextDisabledTypes.add(type);
    }
    onUpdatePreferences({ disabledTypes: Array.from(nextDisabledTypes) });
  };

  return (
    <div className="flex h-full flex-col bg-white text-gray-900">
      <div className="flex items-start justify-between border-b border-gray-200 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
            <Bell className="h-4 w-4" />
            Notifications
          </div>
          <h2 className="mt-1 text-lg font-semibold">Trip reminders</h2>
          <p className="mt-1 text-sm text-gray-600">
            {unreadCount} unread item{unreadCount === 1 ? '' : 's'} generated from your itinerary.
          </p>
        </div>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100" aria-label="Close notifications">
          <X size={20} />
        </button>
      </div>

      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <span className="text-xs text-gray-500">In-app only for now</span>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {preferences && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">In-app reminders</p>
                <p className="mt-1 text-xs text-gray-600">Control generated reminders for this trip.</p>
              </div>
              <Switch
                checked={preferences.inAppEnabled}
                onCheckedChange={(checked) => onUpdatePreferences({ inAppEnabled: checked })}
              />
            </div>
            {preferences.inAppEnabled && (
              <div className="mt-3 grid gap-2 text-sm">
                <label className="flex items-center justify-between gap-3">
                  <span>Itinerary insights</span>
                  <Switch
                    checked={!disabledTypes.has('insight')}
                    onCheckedChange={(checked) => toggleDisabledType('insight', checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Upcoming event reminders</span>
                  <Switch
                    checked={!disabledTypes.has('reminder')}
                    onCheckedChange={(checked) => toggleDisabledType('reminder', checked)}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <CheckCircle2 className="h-4 w-4" />
            No active reminders right now.
          </div>
        )}

        {notifications.map((notification) => (
          <div
            key={notification._id}
            className={cn(
              'rounded-lg border p-3',
              severityStyles[notification.severity],
              notification.readAt && 'opacity-70'
            )}
          >
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{notification.title}</p>
                  {!notification.readAt && (
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase">
                      New
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm opacity-90">{notification.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {notification.actionLabel && (
                    <Button variant="outline" size="sm" onClick={() => onAction(notification)}>
                      {notification.actionLabel}
                    </Button>
                  )}
                  {!notification.readAt && (
                    <Button variant="ghost" size="sm" onClick={() => onMarkRead(notification)}>
                      Mark read
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onDismiss(notification)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TripNotifications;
