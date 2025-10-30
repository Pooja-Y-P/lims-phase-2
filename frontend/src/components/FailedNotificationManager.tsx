import React, { useState, useEffect } from 'react';
import { AlertTriangle, Mail, X, RefreshCw, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { api, ENDPOINTS } from '../api/config';

interface FailedNotification {
  id: number;
  recipient_email: string;
  recipient_user_id: number | null;
  recipient_name: string | null;
  subject: string;
  body_text: string;
  error: string;
  created_at: string;
  created_by: string;
  inward_id: number | null;
  srf_no: string | null;
  customer_details: string | null;
  status: string;
}

interface NotificationStats {
  total: number;
  pending: number;
  success: number;
  failed: number;
}

interface FailedNotificationsResponse {
  failed_notifications: FailedNotification[];
  stats: NotificationStats;
}

interface FailedNotificationsManagerProps {
  onClose: () => void;
}

export const FailedNotificationsManager: React.FC<FailedNotificationsManagerProps> = ({ onClose }) => {
  const [notifications, setNotifications] = useState<FailedNotification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, pending: 0, success: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<{ [key: number]: 'retrying' | 'deleting' | null }>({});
  const [emailInputs, setEmailInputs] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    fetchFailedNotifications();
  }, []);

  const fetchFailedNotifications = async () => {
    // Note: We don't set loading to true here to allow for silent background refreshes.
    try {
      // FIX: Construct the URL manually from the base 'NOTIFICATIONS' endpoint.
      // The backend router places this under /staff/inwards, so we use that as the base.
      const response = await api.get<FailedNotificationsResponse>(`${ENDPOINTS.STAFF.INWARDS}/notifications/failed`);
      setNotifications(response.data.failed_notifications);
      setStats(response.data.stats);
      
      // Initialize email inputs with existing emails
      const initialEmails: { [key: number]: string } = {};
      response.data.failed_notifications.forEach(notification => {
        if (notification.recipient_email) {
          initialEmails[notification.id] = notification.recipient_email;
        }
      });
      setEmailInputs(initialEmails);
    } catch (error) {
      console.error('Error fetching failed notifications:', error);
    } finally {
      setLoading(false); // Only set loading to false after the initial fetch.
    }
  };

  const handleEmailInputChange = (notificationId: number, value: string) => {
    setEmailInputs(prev => ({ ...prev, [notificationId]: value }));
  };

  const retryNotification = async (notificationId: number) => {
    const email = emailInputs[notificationId];
    if (!email) {
      alert('Please enter a recipient email address.');
      return;
    }

    setActionState(prev => ({ ...prev, [notificationId]: 'retrying' }));
    try {
      // FIX: Construct the retry URL manually.
      await api.post(`${ENDPOINTS.STAFF.INWARDS}/notifications/${notificationId}/retry`, { email });
      // Re-fetch the list to get the latest data from the server.
      await fetchFailedNotifications();
      alert(`Notification retry queued successfully! Email will be sent to ${email}.`);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to retry notification. Please try again.');
    } finally {
      setActionState(prev => ({ ...prev, [notificationId]: null }));
    }
  };

  const deleteNotification = async (notificationId: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this failed notification? This action cannot be undone.')) {
      return;
    }

    setActionState(prev => ({ ...prev, [notificationId]: 'deleting' }));
    try {
      // FIX: Construct the delete URL manually.
      await api.delete(`${ENDPOINTS.STAFF.INWARDS}/notifications/${notificationId}`);
      // Re-fetch the list to ensure UI consistency.
      await fetchFailedNotifications();
      alert('Failed notification deleted successfully.');
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete notification.');
    } finally {
      setActionState(prev => ({ ...prev, [notificationId]: null }));
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // FIX: Removed the unused 'truncateText' function.

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
            <span>Loading failed notifications...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <AlertTriangle size={24} />
            <h2 className="text-2xl font-semibold">Failed Email Notifications</h2>
            {notifications.length > 0 && (
              <span className="bg-white text-red-600 px-2 py-1 rounded-full text-sm font-bold">{notifications.length}</span>
            )}
          </div>
          <button onClick={onClose} className="hover:bg-red-700 rounded-full p-2 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Stats Section */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
              <div className="text-sm text-gray-600">Success</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-grow">
          {notifications.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center h-full">
              <CheckCircle className="mx-auto h-16 w-16 text-green-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Failed Notifications!</h3>
              <p className="text-gray-500">All email notifications have been sent successfully.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 text-red-800 font-semibold">
                  <AlertTriangle size={20} />
                  <span>ATTENTION: {notifications.length} failed email notification{notifications.length > 1 ? 's' : ''}</span>
                </div>
                <p className="text-red-700 text-sm mt-1">
                  These emails failed to send due to server issues or invalid addresses. You can retry them manually.
                </p>
              </div>

              {notifications.map((notification) => {
                const currentAction = actionState[notification.id];
                const emailForNotification = emailInputs[notification.id] || '';

                return (
                  <div key={notification.id} className="border border-red-200 rounded-lg p-6 bg-red-50 hover:bg-red-100 transition-all duration-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{notification.subject}</h3>
                          {notification.srf_no && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                              SRF {notification.srf_no}
                            </span>
                          )}
                        </div>
                        {notification.customer_details && (
                          <p className="text-gray-600 font-medium mb-1">{notification.customer_details}</p>
                        )}
                        <p className="text-sm text-gray-500 mb-2">
                          Created: {formatDateTime(notification.created_at)} by {notification.created_by}
                        </p>
                      </div>
                      <div className="text-right text-red-600">
                        <Mail size={20} />
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 mb-4 border border-gray-200">
                      <div className="text-sm">
                        <p className="text-red-600 font-medium mb-2">Error Details:</p>
                        <p className="text-red-700 text-xs bg-red-50 p-2 rounded border">
                          {notification.error}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3 mb-4 space-y-2">
                      <label htmlFor={`email-${notification.id}`} className="block text-sm font-medium text-gray-700">
                        Retry with Email:
                      </label>
                      <input
                        id={`email-${notification.id}`}
                        type="email"
                        placeholder="Enter recipient email address..."
                        value={emailForNotification}
                        onChange={(e) => handleEmailInputChange(notification.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={!!currentAction}
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        disabled={!!currentAction}
                        className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50 transition-colors"
                      >
                        {currentAction === 'deleting' ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        <span>{currentAction === 'deleting' ? 'Deleting...' : 'Delete'}</span>
                      </button>
                      <button
                        onClick={() => retryNotification(notification.id)}
                        disabled={!emailForNotification || !!currentAction}
                        className="flex items-center space-x-2 px-6 py-2 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 transition-colors"
                      >
                        {currentAction === 'retrying' ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                        <span>{currentAction === 'retrying' ? 'Retrying...' : 'Retry Email'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-xl border-t">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {notifications.length > 0 
                ? `${notifications.length} failed notification${notifications.length > 1 ? 's' : ''} requiring attention` 
                : 'All notifications handled successfully'
              }
            </p>
            <div className="flex space-x-3">
              <button
                onClick={fetchFailedNotifications}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};