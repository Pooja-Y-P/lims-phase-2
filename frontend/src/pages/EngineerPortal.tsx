import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { Wrench, FileText, Award, ClipboardList, AlertTriangle, ArrowRight, Mail, Download } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { User } from "../types";
import { api, ENDPOINTS } from "../api/config";

// Import page components
import { CreateInwardPage } from "../components/CreateInwardPage";
import { ViewUpdateInward } from "../components/ViewUpdateInward";
import { ViewInward } from "../components/ViewInward";
import { PrintStickers } from "../components/PrintStickers";
import { InwardForm } from "../components/InwardForm";
// import EnhancedSrfManagement from "../components/EnhancedSrfManagement";
import  SrfDetailPage  from "../components/SrfDetailPage"; 
import { DelayedEmailManager } from "../components/DelayedEmailManager";
import { FailedNotificationsManager } from "../components/FailedNotificationManager";
import ExportInwardPage from "../components/ExportInwardPage";
import SrfListPage from "../components/SrfListPage";
// import { ReviewedFirsPage } from "../components/ReviewedFirsPage";

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

// Define the shape of data from the API
interface DelayedTask {
  task_id: number;
}
interface FailedNotification {
  id: number;
}
interface AvailableDraft {
  inward_id: number;
  draft_updated_at: string;
  created_at: string;
  customer_details: string;
  draft_data: { customer_details?: string; equipment_list?: any[]; };
}
interface ReviewedFir {
  inward_id: number;
}
interface FailedNotificationsResponse {
  failed_notifications: FailedNotification[];
  stats: { total: number; pending: number; success: number; failed: number; };
}

// NOTE: The wrapper interface 'PendingEmailResponse' has been removed.

const ActionButton: React.FC<{
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  colorClasses: string;
  badge?: number;
}> = ({ label, description, icon, onClick, colorClasses, badge }) => (
  <button
    onClick={onClick}
    className="group relative p-6 rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.02] border border-gray-100 bg-white hover:border-blue-500 hover:shadow-xl shadow-md"
  >
    <div className="flex items-start">
      <div
        className={`p-3 rounded-xl text-white mr-4 shadow-lg ${colorClasses} group-hover:shadow-2xl transition-shadow duration-300 relative`}
      >
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
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
  const [availableDrafts, setAvailableDrafts] = useState<AvailableDraft[]>([]);
  const [reviewedFirCount, setReviewedFirCount] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [
        pendingEmailsRes,
        failedNotifsRes,
        draftsRes,
        reviewedFirsRes
      ] = await Promise.allSettled([
        // FIX: Expect a direct array of DelayedTask objects
        api.get<DelayedTask[]>(`${ENDPOINTS.STAFF.INWARDS}/delayed-emails/pending`),
        api.get<FailedNotificationsResponse>(`${ENDPOINTS.STAFF.INWARDS}/notifications/failed`),
        api.get<AvailableDraft[]>(`${ENDPOINTS.STAFF.INWARDS}/drafts`), // Corrected endpoint for drafts
        api.get<ReviewedFir[]>(`${ENDPOINTS.STAFF.INWARDS}/reviewed-firs`)
      ]);

      // FIX: Use .data.length directly on the response
      if (pendingEmailsRes.status === 'fulfilled') {
        setPendingEmailCount(pendingEmailsRes.value.data.length);
      }
      if (failedNotifsRes.status === 'fulfilled') {
        setFailedNotificationCount(failedNotifsRes.value.data.failed_notifications.length);
      }
      if (draftsRes.status === 'fulfilled') {
        setAvailableDrafts(draftsRes.value.data || []);
      }
      if (reviewedFirsRes.status === 'fulfilled') {
        setReviewedFirCount(reviewedFirsRes.value.data.length);
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const EngineerDashboard = () => {
    const navigate = useNavigate();

    const quickActions = [
      {
        label: "Create Inward",
        description: "Process incoming equipment and SRF items",
        icon: <ClipboardList className="h-8 w-8" />,
        route: "create-inward",
        colorClasses: "bg-gradient-to-r from-blue-500 to-indigo-600",
        badge: availableDrafts.length
      },
      {
        label: "View & Update Inward",
        description: "Manage existing inward entries and SRFs",
        icon: <Wrench className="h-8 w-8" />,
        route: "view-inward",
        colorClasses: "bg-gradient-to-r from-cyan-500 to-blue-600",
      },
      {
        label: "Export Inward",
        description: "Filter and export updated inward records",
        icon: <Download className="h-8 w-8" />,
        route: "export-inward",
        colorClasses: "bg-gradient-to-r from-indigo-500 to-purple-600",
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

        {pendingEmailCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-start gap-4">
              <Mail className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-900 mb-2">
                  Scheduled Email Reminders ({pendingEmailCount})
                </h3>
                <p className="text-orange-800 text-sm mb-3">
                  You have {pendingEmailCount} email(s) scheduled to be sent later. You can manage or send them immediately from here.
                </p>
                <button
                  onClick={() => setShowDelayedEmails(true)}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-700 transition-colors text-sm"
                >
                  Manage Scheduled Emails
                </button>
              </div>
            </div>
          </div>
        )}

        {failedNotificationCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-6 w-6 text-red-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-900 mb-2">
                  Failed Email Notifications ({failedNotificationCount})
                </h3>
                <p className="text-red-800 text-sm mb-3">
                  Some email notifications failed to send. Please review and retry them to ensure customers receive important updates.
                </p>
                <button
                  onClick={() => setShowFailedNotifications(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                >
                  Review Failed Emails
                </button>
              </div>
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
                badge={action.badge}
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
          <Route path="create-inward" element={<CreateInwardPage />} />
          <Route path="view-inward" element={<ViewUpdateInward />} />
          <Route path="view-inward/:id" element={<ViewInward />} />
          <Route path="edit-inward/:id" element={<InwardForm initialDraftId={null} />} />
          <Route path="print-stickers/:id" element={<PrintStickers />} />
          
          <Route path="export-inward" element={<ExportInwardPage />} />
          <Route path="srfs" element={<SrfListPage />} />
          <Route path="srfs/:srfId" element={<SrfDetailPage />} />
          
          {/* <Route path="reviewed-firs" element={<ReviewedFirsPage />} /> */}
          
          <Route path="certificates" element={<CertificatesPage />} />
          <Route path="deviations" element={<DeviationPage />} />
        </Routes>
      </main>

      {showDelayedEmails && (
        <DelayedEmailManager
          onClose={() => {
            setShowDelayedEmails(false);
            fetchDashboardData();
          }}
        />
      )}

      {showFailedNotifications && (
        <FailedNotificationsManager
          onClose={() => {
            setShowFailedNotifications(false);
            fetchDashboardData();
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default EngineerPortal;