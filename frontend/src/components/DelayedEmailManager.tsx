import React, { useState, useEffect } from 'react';
import { Clock, Mail, X, AlertTriangle, Send, Trash2, Loader2, Plus } from 'lucide-react';
import { api, ENDPOINTS } from '../api/config';

interface DelayedTask {
  id: number;
  inward_id: number;
  srf_no: string;
  customer_details: string;
  recipient_email: string | null;
  scheduled_at: string;
  time_left_seconds: number;
  is_overdue: boolean;
  created_at: string;
}

interface DelayedEmailManagerProps {
  onClose: () => void;
}

export const DelayedEmailManager: React.FC<DelayedEmailManagerProps> = ({ onClose }) => {
  const [tasks, setTasks] = useState<DelayedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<{ [key: number]: 'sending' | 'cancelling' | null }>({});
  const [timers, setTimers] = useState<{ [key: number]: number }>({});
  
  // CHANGED: Stores an array of email strings for each task ID
  const [emailInputs, setEmailInputs] = useState<{ [key: number]: string[] }>({});

  useEffect(() => {
    fetchPendingTasks();
    const pollInterval = setInterval(fetchPendingTasks, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prevTimers => {
        const newTimers = { ...prevTimers };
        for (const taskId in newTimers) {
          if (newTimers[taskId] > 0) {
            newTimers[taskId]--;
          }
        }
        return newTimers;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingTasks = async () => {
    try {
      if (tasks.length === 0 && !loading) setLoading(true);
      
      const response = await api.get<DelayedTask[]>(`${ENDPOINTS.STAFF.INWARDS}/delayed-emails/pending`);
      const pendingTasks = response.data;
      setTasks(pendingTasks);
      
      const initialTimers: { [key: number]: number } = {};
      const initialEmails: { [key: number]: string[] } = {};
      
      pendingTasks.forEach((task) => {
        initialTimers[task.id] = task.time_left_seconds;
        
        // Initialize emails: if exists, split by comma (just in case), otherwise start with one empty field
        if (!emailInputs[task.id]) {
            if (task.recipient_email) {
                // Handle cases where backend might send "email1, email2" string
                initialEmails[task.id] = task.recipient_email.split(',').map(e => e.trim());
            } else {
                initialEmails[task.id] = [''];
            }
        }
      });
      
      setTimers(initialTimers);
      // Merge new initials with existing state to preserve user typing
      setEmailInputs(prev => ({...initialEmails, ...prev}));

    } catch (error) {
      console.error('Error fetching pending tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Email List Handlers ---

  const handleEmailChange = (taskId: number, index: number, value: string) => {
    setEmailInputs(prev => {
      const currentEmails = [...(prev[taskId] || [''])];
      currentEmails[index] = value;
      return { ...prev, [taskId]: currentEmails };
    });
  };

  const addEmailField = (taskId: number) => {
    setEmailInputs(prev => {
      const currentEmails = [...(prev[taskId] || [])];
      return { ...prev, [taskId]: [...currentEmails, ''] };
    });
  };

  const removeEmailField = (taskId: number, index: number) => {
    setEmailInputs(prev => {
      const currentEmails = [...(prev[taskId] || [''])];
      // Prevent removing the last field
      if (currentEmails.length === 1) {
          currentEmails[0] = '';
          return { ...prev, [taskId]: currentEmails };
      }
      const updatedEmails = currentEmails.filter((_, i) => i !== index);
      return { ...prev, [taskId]: updatedEmails };
    });
  };

  // ---------------------------

  const sendEmailNow = async (taskId: number, emailList: string[]) => {
    // Filter valid emails
    const validEmails = emailList
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'));

    if (validEmails.length === 0) {
      alert('Please enter at least one valid recipient email address.');
      return;
    }

    setActionState(prev => ({ ...prev, [taskId]: 'sending' }));
    try {
      // Backend should accept 'emails' (array) or 'email' (comma separated)
      // We send 'emails' array here. Ensure your Backend endpoint supports this.
      await api.post(`${ENDPOINTS.STAFF.INWARDS}/delayed-emails/${taskId}/send`, { 
        emails: validEmails 
      });
      
      await fetchPendingTasks();
      alert(`First inspection report sent to ${validEmails.length} recipient(s) successfully!`);
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
      await api.delete(`${ENDPOINTS.STAFF.INWARDS}/delayed-emails/${taskId}`);
      await fetchPendingTasks();
      alert('Delayed email task cancelled successfully.');
    } catch (error: any) {
      console.error('Error cancelling task:', error);
      alert(error.response?.data?.detail || 'Failed to cancel task');
    } finally {
      setActionState(prev => ({ ...prev, [taskId]: null }));
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '00s';
    }
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
            <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
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
              {tasks.some(task => task.is_overdue || (timers[task.id] !== undefined && timers[task.id] <= 0)) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center space-x-2 text-red-800 font-semibold"><AlertTriangle size={20} /><span>URGENT: Some reports are overdue!</span></div>
                  <p className="text-red-700 text-sm mt-1">Please enter an email and send these reports immediately.</p>
                </div>
              )}

              {tasks.map((task) => {
                const timeLeft = timers[task.id] ?? task.time_left_seconds;
                const isOverdue = task.is_overdue || timeLeft <= 0;
                const isUrgent = timeLeft > 0 && timeLeft < 3600;
                const currentAction = actionState[task.id];
                
                // Get array of emails for this task (default to one empty if undefined)
                const emailsForTask = emailInputs[task.id] || [''];
                
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

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Recipient Emails:</label>
                      <div className="space-y-2">
                        {emailsForTask.map((email, index) => (
                            <div key={index} className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="Enter customer's email address..."
                                    value={email}
                                    onChange={(e) => handleEmailChange(task.id, index, e.target.value)}
                                    className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                    disabled={!!currentAction}
                                />
                                {emailsForTask.length > 1 && (
                                    <button 
                                        onClick={() => removeEmailField(task.id, index)}
                                        disabled={!!currentAction}
                                        className="px-3 py-2 text-red-600 hover:bg-red-100 rounded-lg border border-transparent hover:border-red-200"
                                        title="Remove email"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                        <button 
                            onClick={() => addEmailField(task.id)}
                            disabled={!!currentAction}
                            className="text-sm flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium mt-2 px-1"
                        >
                            <Plus size={16} /> <span>Add Another Email</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button onClick={() => cancelTask(task.id)} disabled={!!currentAction} className="flex items-center space-x-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50">
                        {currentAction === 'cancelling' ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 size={16} />}
                        <span>{currentAction === 'cancelling' ? 'Cancelling...' : 'Cancel'}</span>
                      </button>
                      <button 
                        onClick={() => sendEmailNow(task.id, emailsForTask)} 
                        disabled={emailsForTask.every(e => !e.trim()) || !!currentAction} 
                        className="flex items-center space-x-2 px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                      >
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
            <p className="text-sm text-gray-600">{tasks.length > 0 ? `${tasks.filter(t => t.is_overdue || (timers[t.id] !== undefined && timers[t.id] <= 0)).length} overdue, ${tasks.length} total` : 'All scheduled reports have been handled'}</p>
            <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};