import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Srf, DashboardProps } from "../types";
import { AlertCircle, Award, PlusCircle, ClipboardList, Activity } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

// --- Custom Types from original CustomerPortal.tsx ---
interface DashboardStats {
  totalSrfs: number;
  activeDeviations: number;
  readyCertificates: number;
  draftSrfs: number;
}

// --- Mock API Function ---
const apiFetchCustomerSrfs = async (customerId: number): Promise<Srf[]> => {
  console.log(`Fetching SRFs for customer ${customerId}...`);
  // Extended the mock data for better stat representation
  return [
    { srf_id: 1001, inward_id: 2001, nepl_srf_no: "N-SRF-001", status: "completed", created_at: "2023-10-01", contact_person: "You" },
    { srf_id: 1002, inward_id: 2002, nepl_srf_no: "N-SRF-002", status: "in-progress", created_at: "2023-10-15", contact_person: "You" },
    { srf_id: 1003, inward_id: 2003, nepl_srf_no: "N-SRF-003", status: "draft", created_at: "2023-10-20", contact_person: "You" },
    { srf_id: 1004, inward_id: 2004, nepl_srf_no: "N-SRF-004", status: "in-progress", created_at: "2023-10-25", contact_person: "You" },
  ];
};

// --- Sub-pages ---
const UpdateSrfPage = () => (
  <div className="p-8 bg-white rounded-2xl shadow-md">
    <h2 className="text-3xl font-semibold text-gray-800 mb-4">Update SRF Details</h2>
    <p className="text-gray-600 mb-6">
      Here you can update your existing SRF records or modify submitted details.
    </p>
    <Link to="/customer" className="text-blue-600 hover:underline">
      &larr; Back to Dashboard
    </Link>
  </div>
);

const ViewDeviationsPage = () => (
  <div className="p-8 bg-white rounded-2xl shadow-md">
    <h2 className="text-3xl font-semibold text-gray-800 mb-4">View Deviations</h2>
    <p className="text-gray-600 mb-6">List of deviations requiring your attention.</p>
    <Link to="/customer" className="text-blue-600 hover:underline">
      &larr; Back to Dashboard
    </Link>
  </div>
);

const CertificatesPage = () => (
  <div className="p-8 bg-white rounded-2xl shadow-md">
    <h2 className="text-3xl font-semibold text-gray-800 mb-4">Certificates</h2>
    <p className="text-gray-600 mb-6">Certificates section coming soon.</p>
    <Link to="/customer" className="text-blue-600 hover:underline">
      &larr; Back to Dashboard
    </Link>
  </div>
);

const SrfListPage: React.FC<{ srfs: Srf[] }> = ({ srfs }) => (
  <div className="p-8 bg-white rounded-2xl shadow-md">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-3xl font-semibold text-gray-800">My SRFs</h2>
      <Link to="/customer" className="text-blue-600 hover:underline">
        &larr; Back to Dashboard
      </Link>
    </div>
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-100 text-gray-700">
          <th className="p-3">SRF No.</th>
          <th className="p-3">Status</th>
          <th className="p-3">Created On</th>
        </tr>
      </thead>
      <tbody>
        {srfs
          .filter(srf => srf.status?.toLowerCase() !== 'draft') // Only show non-drafts in this list, like the original SRFList
          .map((srf) => (
            <tr key={srf.srf_id} className="border-b hover:bg-gray-50">
              <td className="p-3">{srf.nepl_srf_no}</td>
              <td className="p-3 capitalize">{srf.status}</td>
              <td className="p-3">{new Date(srf.created_at).toLocaleDateString()}</td>
            </tr>
        ))}
      </tbody>
    </table>
  </div>
);


// --- Reusable Components (Copied/Adapted from original file) ---

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  gradient: string;
  bgGradient: string;
}> = ({ icon, label, value, description, gradient, bgGradient }) => (
  <div className={`relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 group overflow-hidden`}>
    <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-6">
        <div className={`p-4 bg-gradient-to-r ${gradient} rounded-xl text-white shadow-lg`}>
          {icon}
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-gray-900 group-hover:text-white transition-colors duration-300">
            {value}
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-xl font-semibold text-gray-900 group-hover:text-white transition-colors duration-300 mb-2">
          {label}
        </h3>
        <p className="text-gray-600 group-hover:text-gray-100 transition-colors duration-300 text-sm">
          {description}
        </p>
      </div>
    </div>
  </div>
);

const ActionButton: React.FC<{
  color: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  badgeCount?: number;
}> = ({ color, label, description, icon, onClick, badgeCount }) => (
  <button
    onClick={onClick}
    className="relative group bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 hover:shadow-lg transition-all duration-200 text-left"
  >
    <div className={`inline-flex p-3 bg-gradient-to-r ${color} rounded-xl text-white mb-4 group-hover:scale-110 transition-transform duration-200`}>
      {icon}
    </div>
    <h3 className="font-semibold text-gray-900 text-lg mb-1">{label}</h3>
    <p className="text-gray-600 text-sm">{description}</p>

    {typeof badgeCount === 'number' && badgeCount > 0 && (
      <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-2 py-1 text-xs font-semibold shadow-lg">
        {badgeCount}
      </span>
    )}
  </button>
);

const QuickActions: React.FC<{
  onSelect: (path: string) => void;
  stats: DashboardStats;
}> = ({ onSelect, stats }) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
    <div className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-blue-600">
      <h2 className="text-2xl font-bold text-white">Quick Actions</h2>
      <p className="text-indigo-100 mt-1">Choose an action to get started</p>
    </div>
    <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-6">
      <ActionButton
        color="from-green-500 to-emerald-600"
        label="View SRF List"
        description="View all SRFs and create a new one"
        icon={<PlusCircle className="h-8 w-8" />}
        onClick={() => onSelect('/customer/srf-list')}
      />
      <ActionButton
        color="from-blue-500 to-indigo-600"
        label="Update SRF Details"
        description="Modify existing SRF details"
        icon={<ClipboardList className="h-8 w-8" />}
        badgeCount={stats.draftSrfs}
        onClick={() => onSelect('/customer/update-srf')}
      />
      <ActionButton
        color="from-orange-500 to-red-500"
        label="View Deviations"
        description="Track active issues"
        icon={<AlertCircle className="h-8 w-8" />}
        badgeCount={stats.activeDeviations}
        onClick={() => onSelect('/customer/deviations')}
      />
      <ActionButton
        color="from-purple-500 to-indigo-600"
        label="Certificates"
        description="Download certificates"
        icon={<Award className="h-8 w-8" />}
        badgeCount={stats.readyCertificates}
        onClick={() => onSelect('/customer/certificates')}
      />
    </div>
  </div>
);

// --- Dashboard Home (Matched style) ---
const CustomerDashboardHome: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
  const navigate = useNavigate();

  // Mock profile data/completion since the second file doesn't load it
  const username = "Customer";

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header Section - Simplified version for this file's context */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl shadow-lg">
                <ClipboardList className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Customer Portal</h1>
                <p className="text-lg text-gray-600 mt-1">
                  Welcome back, {username}
                </p>
              </div>
            </div>
            <p className="text-gray-600 max-w-2xl leading-relaxed">
              Manage your calibration service requests, track progress, and access certificates all in one place. 
              Our streamlined platform makes it easy to submit new requests and monitor existing ones.
            </p>
          </div>
        </div>

        {/* Draft Notification Banner */}
        {stats.draftSrfs > 0 && (
          <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg shadow-sm flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
            <p>
              You have <span className="font-semibold">{stats.draftSrfs}</span> draft service request(s). 
              Don't forget to complete and submit them.
            </p>
          </div>
        )}

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <StatCard
            icon={<Activity className="h-10 w-10" />}
            label="Total Service Requests"
            value={stats.totalSrfs}
            description="Submitted SRFs in system"
            gradient="from-blue-500 to-blue-600"
            bgGradient="from-blue-50 to-blue-100"
          />
          <StatCard
            icon={<AlertCircle className="h-10 w-10" />}
            label="Active Deviations"
            value={stats.activeDeviations}
            description="Issues requiring attention"
            gradient="from-orange-500 to-red-500"
            bgGradient="from-orange-50 to-red-50"
          />
          <StatCard
            icon={<Award className="h-10 w-10" />}
            label="Ready Certificates"
            value={stats.readyCertificates}
            description="Available for download"
            gradient="from-green-500 to-emerald-600"
            bgGradient="from-green-50 to-emerald-50"
          />
        </div>

        {/* Quick Actions */}
        <QuickActions onSelect={navigate} stats={stats} />
      </div>
    </div>
  );
};

// --- Customer Portal ---
const CustomerPortal: React.FC<DashboardProps> = ({ onLogout }) => {
  const { user } = useAuth();
  const [srfs, setSrfs] = useState<Srf[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSrfs = useCallback(async () => {
    if (!user?.customer_id) {
      setLoading(false);
      return;
    }
    const data = await apiFetchCustomerSrfs(user.customer_id);
    setSrfs(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSrfs();
  }, [fetchSrfs]);

  if (loading) return <div className="p-8 text-lg text-gray-600">Loading Customer Data...</div>;

  // Mocked stats based on the available SRF data and hardcoded deviation/certificate counts
  const draftCount = srfs.filter((s) => s.status === "draft").length;
  const submittedCount = srfs.length - draftCount;

  const stats: DashboardStats = {
    totalSrfs: submittedCount,
    draftSrfs: draftCount,
    // Mocked values for activeDeviations and readyCertificates
    activeDeviations: 2,
    readyCertificates: 3,
  };


  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header onLogout={onLogout} username={user?.full_name || user?.username || 'Customer'} role="Customer" />
        <main className="flex-1">
        <Routes>
          <Route path="/" element={<CustomerDashboardHome stats={stats} />} />
          <Route path="/srf-list" element={<SrfListPage srfs={srfs} />} />
          <Route path="/update-srf" element={<UpdateSrfPage />} />
          <Route path="/deviations" element={<ViewDeviationsPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export default CustomerPortal;