import React from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import {
  Wrench,
  FileText,
  Award,
  ClipboardList,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { User } from "../types"; // Use the existing User type

// --- Import the real, functional components ---
import { InwardForm } from "../components/InwardForm";
import { SrfManagement } from "../components/SrfManagement";
import { SrfForm } from "../components/SrfForm";

// --- Placeholders for pages you haven't built yet ---
const CertificatesPage = () => <div className="p-8 bg-white rounded-2xl shadow-lg">Certificates Page Content</div>;
const DeviationPage = () => <div className="p-8 bg-white rounded-2xl shadow-lg">Deviation View Page Content</div>;

interface EngineerPortalProps {
  user: User | null;
  onLogout: () => void;
}

// Reusable UI component for the action buttons on the dashboard
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
      <div className={`p-3 rounded-xl text-white mr-4 shadow-lg ${colorClasses} group-hover:shadow-2xl transition-shadow duration-300`}>
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

// The Main EngineerPortal Layout Component
const EngineerPortal: React.FC<EngineerPortalProps> = ({ user, onLogout }) => {
  const username = user?.full_name || user?.email || "Engineer";

  // This is the component for the main dashboard view at `/engineer`
  const EngineerDashboard = () => {
    const navigate = useNavigate();
    const quickActions = [
      {
        label: "Create Inward",
        description: "Process incoming equipment and SRF items",
        icon: <ClipboardList className="h-8 w-8" />,
        route: "inward", // Relative route
        colorClasses: "bg-gradient-to-r from-blue-500 to-indigo-600",
      },
      {
        label: "SRF Management",
        description: "View and manage Service Request Forms",
        icon: <FileText className="h-8 w-8" />,
        route: "srfs", // Relative route
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
              <p className="mt-1 text-base text-gray-600">Manage calibration jobs, certificates, and equipment intake</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-3">Quick Actions</h2>
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
          {/* Main dashboard view at /engineer */}
          <Route path="/" element={<EngineerDashboard />} />
          
          {/* Nested pages that will replace the dashboard content */}
          <Route path="inward" element={<InwardForm />} />
          <Route path="srfs" element={<SrfManagement />} />
          <Route path="srf/:srfId" element={<SrfForm />} />
          <Route path="certificates" element={<CertificatesPage />} />
          <Route path="deviations" element={<DeviationPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default EngineerPortal;