import React, { useEffect, useState } from 'react';
import { AlertCircle, X, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

const WARNING_THRESHOLD_SECONDS = 30;

const formatTimeRemaining = (seconds: number) => {
  if (seconds <= 0 || Number.isNaN(seconds)) {
    return '0s';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }

  return `${remainingSeconds}s`;
};

const TokenExpirationNotification: React.FC = () => {
  const {
    isTokenExpiringSoon,
    timeUntilExpiry,
    logout,
  } = useAuth();

  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    setShowWarning(
      Boolean(isTokenExpiringSoon) &&
        typeof timeUntilExpiry === 'number' &&
        timeUntilExpiry <= WARNING_THRESHOLD_SECONDS &&
        timeUntilExpiry > 0
    );
  }, [isTokenExpiringSoon, timeUntilExpiry]);

  const handleDismiss = () => {
    setShowWarning(false);
  };

  if (!showWarning || typeof timeUntilExpiry !== 'number' || timeUntilExpiry <= 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-5">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-yellow-800">Session Expiring Soon</h3>
              <button
                onClick={handleDismiss}
                className="ml-4 inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none"
                aria-label="Dismiss session expiry warning"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2">
              <p className="text-sm text-yellow-700">
                Your session will expire in{' '}
                <span className="font-semibold">{formatTimeRemaining(timeUntilExpiry)}</span>. Save
                your work to avoid losing progress.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-50 bg-rose-500 hover:bg-rose-600 rounded-md transition-colors"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenExpirationNotification;

