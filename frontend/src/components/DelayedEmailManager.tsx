import React, { useState, useEffect } from 'react';
import { Clock, Mail, X, AlertTriangle, Send, Trash2, Loader2 } from 'lucide-react';
import { api, ENDPOINTS } from '../api/config';

interface DelayedTask {
  id: number;
  inward_id: number;
  srf_no: string;
  customer_details: string;
  recipient_email: string | null; // Email can be null initially
  scheduled_at: string;
  time_left_seconds: number;
  is_overdue: boolean;
  created_at: string;
}

interface PendingTasksResponse {
  pending_tasks: DelayedTask[];
}

interface DelayedEmailManagerProps {
  onClose: () => void;
}

export const DelayedEmailManager: React.FC<DelayedEmailManagerProps> = ({ onClose }) => {
  const [tasks, setTasks] = useState<DelayedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<{ [key: number]: 'sending' | 'cancelling' | null }>({});
  const [timers, setTimers] = useState<{ [key: number]: number }>({});
  const [emailInputs, setEmailInputs] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    fetchPendingTasks();

    const interval = setInterval(() => {
      setTimers(prev => {
        const newTimers = { ...prev };
        setTasks(currentTasks => {
          currentTasks.forEach(task => {
            if (newTimers[task.id] > 0) {
              newTimers[task.id] = Math.max(0, newTimers[task.id] - 1);
            }
          });
          return currentTasks;
        });
        return newTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const fetchPendingTasks = async () => {
    try {
      const response = await api.get<PendingTasksResponse>(`${ENDPOINTS.INWARDS}/delayed-emails/pending`);
      const pendingTasks = response.data.pending_tasks;
      setTasks(pendingTasks);
      
      const initialTimers: { [key: number]: number } = {};
      const initialEmails: { [key: number]: string } = {};
      pendingTasks.forEach((task: DelayedTask) => {
        initialTimers[task.id] = task.time_left_seconds;
        if (task.recipient_email) {
            initialEmails[task.id] = task.recipient_email;
        }
      });
      setTimers(initialTimers);
      setEmailInputs(initialEmails);
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailInputChange = (taskId: number, value: string) => {
    setEmailInputs(prev => ({ ...prev, [taskId]: value }));
  };

  const sendEmailNow = async (taskId: number, email: string) => {
    if (!email) {
      alert('Please enter a recipient email address.');
      return;
    }
    setActionState(prev => ({ ...prev, [taskId]: 'sending' }));
    try {
      await api.post(`${ENDPOINTS.INWARDS}/delayed-emails/${taskId}/send`, { email });
      setTasks(prev => prev.filter(task => task.id !== taskId));
      alert(`First inspection report sent to ${email} successfully!`);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to send email. Please try again.');
    } finally {
      setActionState(prev => ({ ...prev, [taskId]: null }));
    }
  };

  const cancelTask = async (taskId: number) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email? This action cannot be undone.')) {
      return;
    }
    setActionState(prev => ({ ...prev, [taskId]: 'cancelling' }));
    try {
      await api.delete(`${ENDPOINTS.INWARDS}/delayed-emails/${taskId}`);
      setTasks(prev => prev.filter(task => task.id !== taskId));
      alert('Delayed email task cancelled successfully.');
    } catch (error) {
      console.error('Error cancelling task:', error);
      alert('Failed to cancel task');
    } finally {
      setActionState(prev => ({ ...prev, [taskId]: null }));
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Overdue';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    const pad = (num: number) => num.toString().padStart(2, '0');

    if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m ${pad(remainingSeconds)}s`;
    if (minutes > 0) return `${pad(minutes)}m ${pad(remainingSeconds)}s`;
    return `${pad(remainingSeconds)}s`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading scheduled tasks...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Clock size={24} />
            <h2 className="text-2xl font-semibold">Scheduled Inspection Reports</h2>
            {tasks.length > 0 && (
              <span className="bg-white text-orange-600 px-2 py-1 rounded-full text-sm font-bold">{tasks.length}</span>
            )}
          </div>
          <button onClick={onClose} className="hover:bg-orange-700 rounded-full p-2 transition-colors"><X size={24} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow">
          {tasks.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center h-full">
              <Mail className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">All Caught Up!</h3>
              <p className="text-gray-500">No inspection reports are currently scheduled.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.some(task => task.is_overdue || (timers[task.id] && timers[task.id] <= 0)) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 text-red-800 font-semibold"><AlertTriangle size={20} /><span>URGENT: Some reports are overdue!</span></div>
                  <p className="text-red-700 text-sm mt-1">Please enter an email and send these reports immediately.</p>
                </div>
              )}

              {tasks.map((task) => {
                const timeLeft = timers[task.id] ?? 0;
                const isOverdue = task.is_overdue || timeLeft <= 0;
                const isUrgent = timeLeft > 0 && timeLeft < 3600;
                const currentAction = actionState[task.id];
                const emailForTask = emailInputs[task.id] || '';

                return (
                  <div key={task.id} className={`border rounded-lg p-6 transition-all duration-200 ${isOverdue ? 'border-red-300 bg-red-50' : isUrgent ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">SRF {task.srf_no}</h3>
                        <p className="text-gray-600 font-medium">{task.customer_details}</p>
                      </div>
                      <div className={`text-right ${isOverdue ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-blue-600'}`}>
                        <div className="flex items-center space-x-2"><Clock size={16} /><span className="font-mono font-bold text-lg">{formatTimeRemaining(timeLeft)}</span></div>
                        {isOverdue && (<p className="text-xs text-red-500 font-medium">Action Required!</p>)}
                        {isUrgent && !isOverdue && (<p className="text-xs text-orange-500 font-medium">Expires Soon!</p>)}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                      <label htmlFor={`email-${task.id}`} className="block text-sm font-medium text-gray-700">Recipient Email:</label>
                      <input
                        id={`email-${task.id}`}
                        type="email"
                        placeholder="Enter customer's email address..."
                        value={emailForTask}
                        onChange={(e) => handleEmailInputChange(task.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        disabled={!!currentAction}
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button onClick={() => cancelTask(task.id)} disabled={!!currentAction} className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50">
                        {currentAction === 'cancelling' ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 size={16} />}
                        <span>{currentAction === 'cancelling' ? 'Cancelling...' : 'Cancel'}</span>
                      </button>
                      <button onClick={() => sendEmailNow(task.id, emailForTask)} disabled={!emailForTask || !!currentAction} className="flex items-center space-x-2 px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300">
                        {currentAction === 'sending' ? <Loader2 className="animate-spin h-4 w-4" /> : <Send size={16} />}
                        <span>{currentAction === 'sending' ? 'Sending...' : 'Send Now'}</span>
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
            <p className="text-sm text-gray-600">{tasks.length > 0 ? `${tasks.filter(t => t.is_overdue || (timers[t.id] && timers[t.id] <= 0)).length} overdue, ${tasks.length} total` : 'All scheduled reports have been handled'}</p>
            <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};