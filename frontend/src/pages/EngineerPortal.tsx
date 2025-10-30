import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import {
  Wrench,
  FileText,
  Award,
  ClipboardList,
  AlertTriangle,
  ArrowRight,
  Mail,
  Clock,
  XCircle,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { User } from "../types";
import { api, ENDPOINTS } from "../api/config";

// Import page components
import { InwardForm } from "../components/InwardForm";
import { ViewUpdateInward } from "../components/ViewUpdateInward";
import { ViewInward } from "../components/ViewInward";
import { PrintStickers } from "../components/PrintStickers";
import EnhancedSrfManagement from "../components/EnhancedSrfManagement";
// --- ADD THIS IMPORT ---
import { SrfDetailPage } from "../components/SrfDetailPage"; 
import { DelayedEmailManager } from "../components/DelayedEmailManager";
import { FailedNotificationsManager } from "../components/FailedNotificationManager";

const CertificatesPage = () => (
  <div className="p-8 bg-white rounded-2xl shadow-lg">Certificates Page Content</div>
);

const DeviationPage = () => (
  <div className="p-8 bg-white rounded-2xl shadow-lg">Deviation View Page Content</div>
);

interface EngineerPortalProps {
  user: User | null;
  onLogout: () => void;
}

interface PendingEmailResponse {
  pending_tasks: any[];
}

interface FailedNotificationsResponse {
  failed_notifications: any[];
  stats: {
    total: number;
    pending: number;
    success: number;
    failed: number;
  };
}

const ActionButton: React.FC<{
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  colorClasses: string;
}> = ({ label, description, icon, onClick, colorClasses }) => (
  <button
    onClick={onClick}
    className="group relative p-6 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.02] border border-gray-100 bg-white hover:border-blue-500 hover:shadow-xl shadow-md"
  >
    <div className="flex items-start">
      <div
        className={`p-3 rounded-xl text-white mr-4 shadow-lg ${colorClasses} group-hover:shadow-2xl transition-shadow duration-300`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-bold text-gray-900 mb-1">{label}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
      <ArrowRight className="ml-4 h-6 w-6 text-gray-400 group-hover:text-blue-600 transition-colors duration-300" />
    </div>
  </button>
);

const EngineerPortal: React.FC<EngineerPortalProps> = ({ user, onLogout }) => {
  const username = user?.full_name || user?.email || "Engineer";
  const [pendingEmailCount, setPendingEmailCount] = useState(0);
  const [failedNotificationCount, setFailedNotificationCount] = useState(0);
  const [showDelayedEmails, setShowDelayedEmails] = useState(false);
  const [showFailedNotifications, setShowFailedNotifications] = useState(false);

  useEffect(() => {
    fetchPendingEmailCount();
    fetchFailedNotificationCount();
    
    // Refresh counts every 30 seconds
    const interval = setInterval(() => {
      fetchPendingEmailCount();
      fetchFailedNotificationCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchPendingEmailCount = async () => {
    try {
      const response = await api.get<PendingEmailResponse>(
        `${ENDPOINTS.STAFF.INWARDS}/delayed-emails/pending`
      );
      setPendingEmailCount(response.data.pending_tasks.length);
    } catch (error: any) {
      console.error("Error fetching pending email count:", error);
      if (error.response?.status === 404) {
        setPendingEmailCount(0);
      }
    }
  };

  const fetchFailedNotificationCount = async () => {
    try {
      const response = await api.get<FailedNotificationsResponse>(
        `${ENDPOINTS.STAFF.INWARDS}/notifications/failed`
      );
      setFailedNotificationCount(response.data.failed_notifications.length);
    } catch (error: any) {
      console.error("Error fetching failed notification count:", error);
      if (error.response?.status === 404) {
        setFailedNotificationCount(0);
      }
    }
  };

  const EngineerDashboard = () => {
    const navigate = useNavigate();

    const quickActions = [
      {
        label: "Create Inward",
        description: "Process incoming equipment and SRF items",
        icon: <ClipboardList className="h-8 w-8" />,
        route: "inward",
        colorClasses: "bg-gradient-to-r from-blue-500 to-indigo-600",
      },
      {
        label: "View & Update Inward",
        description: "View, update, and manage existing inward entries",
        icon: <Wrench className="h-8 w-8" />,
        route: "view-inward",
        colorClasses: "bg-gradient-to-r from-cyan-500 to-blue-600",
      },
      {
        label: "SRF Management",
        description: "View and manage Service Request Forms",
        icon: <FileText className="h-8 w-8" />,
        route: "srfs",
        colorClasses: "bg-gradient-to-r from-green-500 to-emerald-600",
      },
      {
        label: "Certificates",
        description: "Generate and manage certificates",
        icon: <Award className="h-8 w-8" />,
        route: "certificates",
        colorClasses: "bg-gradient-to-r from-purple-500 to-indigo-600",
      },
      {
        label: "View Deviations",
        description: "Access deviation reports",
        icon: <AlertTriangle className="h-8 w-8" />,
        route: "deviations",
        colorClasses: "bg-gradient-to-r from-orange-500 to-red-500",
      },
    ];

    return (
      <div>
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg">
            <Wrench className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Engineer Portal</h1>
            <p className="mt-1 text-base text-gray-600">
              Manage calibration jobs, certificates, and equipment intake
            </p>
          </div>
        </div>

        {/* Scheduled Email Notifications */}
        {pendingEmailCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-900">
                    Scheduled Inspection Reports
                  </h3>
                  <p className="text-orange-700">
                    You have{" "}
                    <span className="font-bold">{pendingEmailCount}</span>{" "}
                    report{pendingEmailCount > 1 ? "s" : ""} scheduled to be sent
                    later.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDelayedEmails(true)}
                className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-lg transition-colors shadow-md"
              >
                <Mail className="h-5 w-5" />
                <span>Manage Scheduled Reports</span>
              </button>
            </div>
          </div>
        )}

        {/* Failed Email Notifications */}
        {failedNotificationCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-900">
                    Failed Email Notifications
                  </h3>
                  <p className="text-red-700">
                    <span className="font-bold">{failedNotificationCount}</span>{" "}
                    email{failedNotificationCount > 1 ? "s" : ""} failed to send due to server issues.
                    Manual retry required.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFailedNotifications(true)}
                className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-lg transition-colors shadow-md"
              >
                <AlertTriangle className="h-5 w-5" />
                <span>Handle Failed Emails</span>
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {quickActions.map((action) => (
              <ActionButton
                key={action.label}
                label={action.label}
                description={action.description}
                icon={action.icon}
                onClick={() => navigate(action.route)}
                colorClasses={action.colorClasses}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header username={username} role="Engineer" onLogout={onLogout} />
      <main className="flex-1 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 w-full">
        <Routes>
          <Route path="/" element={<EngineerDashboard />} />
          <Route path="inward" element={<InwardForm />} />
          <Route path="view-inward" element={<ViewUpdateInward />} />
          <Route path="view-inward/:id" element={<ViewInward />} />
          <Route path="edit-inward/:id" element={<InwardForm />} />
          <Route path="print-stickers/:id" element={<PrintStickers />} />
          
          {/* SRF Routes */}
          {/* FIX: Removed the 'onStatusChange' prop as it's no longer required by the component. */}
          <Route path="srfs" element={<EnhancedSrfManagement />} />
          
          <Route path="srfs/:srfId" element={<SrfDetailPage />} />
          
          <Route path="certificates" element={<CertificatesPage />} />
          <Route path="deviations" element={<DeviationPage />} />
        </Routes>
      </main>

      {showDelayedEmails && (
        <DelayedEmailManager
          onClose={() => {
            setShowDelayedEmails(false);
            fetchPendingEmailCount();
          }}
        />
      )}

      {showFailedNotifications && (
        <FailedNotificationsManager
          onClose={() => {
            setShowFailedNotifications(false);
            fetchFailedNotificationCount();
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default EngineerPortal;