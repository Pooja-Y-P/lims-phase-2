import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Srf, DashboardProps } from "../types";
import {
  AlertCircle,
  Award,
  ClipboardList,
  Activity,
  ChevronLeft,
  FileText,
  AlertTriangle,
  Search,
  Download,
  ArrowRight,
  Clock,
  Bell,
  CheckCircle
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from '../api/config';
import { CustomerRemarksPortal } from '../components/CustomerRemarksPortal';
import CustomerSrfDetailView from "../components/CustomerSrfDetailView"; 
import CustomerSrfListView from "../components/CustomerSrfListView";
import TrackStatusPage from "../components/TrackStatusPage";

// --- LOCAL TYPE DEFINITIONS ---
interface FirForReview {
  inward_id: number;
  srf_no: string;
  date?: string; 
  material_inward_date?: string;
  status: string;
}

interface DashboardStats {
  totalSrfs: number;
  activeDeviations: number;
  readyCertificates: number;
  draftSrfs: number;
  firsForReview: number;
}

interface SrfApiResponse {
  pending: Srf[];
  approved: Srf[];
  rejected: Srf[];
}

// --- HELPER: Safe Date Formatter ---
const formatSafeDate = (dateStr?: string | null) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// --- SKELETON LOADING COMPONENT ---
const DashboardSkeleton = () => {
  return (
    <div className="animate-pulse w-full">
      {/* Header Section Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-slate-200 rounded-2xl"></div>
          <div className="space-y-3">
            <div className="h-8 w-64 bg-slate-200 rounded"></div>
            <div className="h-4 w-40 bg-slate-200 rounded"></div>
          </div>
        </div>
        <div className="h-12 w-12 bg-slate-200 rounded-full self-end md:self-auto"></div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 mt-6">
        {[1, 2, 3].map((item) => (
          <div key={item} className="bg-white rounded-xl p-6 shadow-md border border-gray-100 h-36">
            <div className="flex justify-between items-start mb-4">
              <div className="h-12 w-12 bg-slate-200 rounded-xl"></div>
              <div className="h-10 w-16 bg-slate-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-5 w-32 bg-slate-200 rounded"></div>
              <div className="h-3 w-24 bg-slate-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="h-8 w-48 bg-slate-200 rounded mb-6 border-b pb-3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="p-6 rounded-2xl border border-gray-100 bg-white flex items-center">
              <div className="h-14 w-14 bg-slate-200 rounded-xl mr-4 shadow-sm"></div>
              <div className="flex-1 space-y-3">
                <div className="h-6 w-32 bg-slate-200 rounded"></div>
                <div className="h-4 w-48 bg-slate-200 rounded"></div>
              </div>
              <div className="ml-4 h-6 w-6 bg-slate-200 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- SUB-PAGES ---

const FirListView: React.FC<{ firs: FirForReview[] }> = ({ firs }) => {
    return (
        <div className="p-6 md:p-8 bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <FileText className="h-8 w-8 text-orange-600" />
                    First Inspection Reports (FIRs)
                </h2>
                <Link to="/customer" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                </Link>
            </div>
            {firs.length > 0 && (
                <div className="mb-6 p-4 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                    <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 mr-3" />
                        <div>
                            <h3 className="text-sm font-medium text-orange-800">Action Required</h3>
                            <p className="mt-1 text-sm text-orange-700">The following inwards have completed first inspection. Please review and provide your feedback.</p>
                        </div>
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 text-sm">
                        <tr>
                            <th className="p-4 font-semibold border-b">SRF No.</th>
                            <th className="p-4 font-semibold border-b">Status</th>
                            <th className="p-4 font-semibold border-b">Inspection Date</th>
                            <th className="p-4 font-semibold border-b">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {firs.length > 0 ? (firs.map((fir) => (
                            <tr key={fir.inward_id} className="hover:bg-slate-50 transition-colors duration-150">
                                <td className="p-4 align-top font-medium text-slate-800">{fir.srf_no}</td>
                                <td className="p-4 align-top">
                                    <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 w-fit">
                                        <AlertTriangle className="h-3 w-3" /> Requires Review
                                    </span>
                                </td>
                                <td className="p-4 align-top text-slate-600">
                                    {formatSafeDate(fir.material_inward_date || fir.date)}
                                </td>
                                <td className="p-4 align-top">
                                    <Link to={`/customer/fir-remarks/${fir.inward_id}`} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 text-sm transition-colors">
                                        <FileText className="h-4 w-4" /> Review
                                    </Link>
                                </td>
                            </tr>
                        ))) : (
                            <tr>
                                <td colSpan={4} className="p-12 text-slate-500 text-center">
                                    <p className="text-sm">No FIRs are currently waiting for your remarks.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- PLACEHOLDER SUB-PAGES ---
const ViewDeviationsPage = () => <div className="p-8 bg-white rounded-2xl shadow-md"><h2 className="text-2xl font-bold mb-4">View Deviations</h2><Link to="/customer" className="text-blue-600">&larr; Back to Dashboard</Link></div>;
const CertificatesPage = () => <div className="p-8 bg-white rounded-2xl shadow-md"><h2 className="text-2xl font-bold mb-4">Certificates</h2><Link to="/customer" className="text-blue-600">&larr; Back to Dashboard</Link></div>;

// --- DASHBOARD COMPONENTS ---

// 1. Notification Center
const NotificationCenter: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const totalNotifications = stats.firsForReview + stats.draftSrfs;

    const handleNavigate = (path: string) => {
        setIsOpen(false);
        navigate(path);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="p-3 bg-white rounded-full shadow-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md transition-all relative group"
            >
                <Bell className={`h-6 w-6 ${isOpen ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'}`} />
                {totalNotifications > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] shadow-sm border-2 border-white transform translate-x-1/4 -translate-y-1/4">
                        {totalNotifications}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800">Notifications</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            {totalNotifications} New
                        </span>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {totalNotifications === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center text-gray-400">
                                <CheckCircle className="h-10 w-10 mb-2 opacity-20" />
                                <p className="text-sm">You're all caught up!</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {/* FIR Notification Item */}
                                {stats.firsForReview > 0 && (
                                    <div 
                                        onClick={() => handleNavigate('/customer/view-firs')}
                                        className="p-4 hover:bg-orange-50 transition-colors cursor-pointer group flex items-start gap-3"
                                    >
                                        <div className="p-2 bg-orange-100 rounded-lg shrink-0 mt-1">
                                            <AlertTriangle className="h-5 w-5 text-orange-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-gray-800">
                                                Action Required
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1 mb-3">
                                                You have <span className="font-bold text-orange-600">{stats.firsForReview}</span> First Inspection Report(s) awaiting your review.
                                            </p>
                                            {/* Button Style Link */}
                                            <span className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-sm group-hover:bg-blue-700 transition-colors">
                                                View Details
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Draft/Pending SRF Notification Item */}
                                {stats.draftSrfs > 0 && (
                                    <div 
                                        onClick={() => handleNavigate('/customer/view-srf')}
                                        className="p-4 hover:bg-yellow-50 transition-colors cursor-pointer group flex items-start gap-3"
                                    >
                                        <div className="p-2 bg-yellow-100 rounded-lg shrink-0 mt-1">
                                            <Clock className="h-5 w-5 text-yellow-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-gray-800">
                                                Approval Pending
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1 mb-3">
                                                You have <span className="font-bold text-yellow-600">{stats.draftSrfs}</span> SRF(s) pending approval or in draft.
                                            </p>
                                            {/* Button Style Link */}
                                            <span className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg shadow-sm group-hover:bg-blue-700 transition-colors">
                                                View Details
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                        <button onClick={() => setIsOpen(false)} className="text-xs text-gray-500 hover:text-gray-800 font-medium">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// 2. Action Button
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
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold border-2 border-white">
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

// 3. Stat Card
const StatCard: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    value: number; 
    description: string; 
    colorClass: string; 
}> = ({ icon, label, value, description, colorClass }) => ( 
    <div className="bg-white rounded-xl p-6 shadow-md border border-gray-100 flex flex-col justify-between h-36 hover:shadow-lg transition-shadow"> 
        <div className="flex justify-between items-start"> 
            <div className={`p-3 rounded-xl text-white ${colorClass} shadow-md`}>
                {icon}
            </div> 
            <div className="text-4xl font-bold text-gray-800">{value}</div> 
        </div> 
        <div className="mt-2"> 
            <h3 className="text-md font-bold text-gray-900">{label}</h3> 
            <p className="text-gray-500 text-xs mt-0.5">{description}</p> 
        </div> 
    </div> 
);

const CustomerDashboardHome: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return ( 
        <div> 
            {/* Header Section with Notification Bell */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"> 
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg">
                        <ClipboardList className="h-10 w-10 text-white" />
                    </div> 
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Customer Portal</h1> 
                        <p className="mt-1 text-base text-gray-600">Welcome back, {user?.full_name || user?.username || "Customer"}</p>
                    </div>
                </div>

                {/* Notification Bell Component positioned here */}
                <div className="flex items-center gap-4 self-end md:self-auto">
                    <NotificationCenter stats={stats} />
                </div>
            </div> 

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 mt-6"> 
                <StatCard 
                    icon={<Activity className="h-6 w-6" />} 
                    label="Total Requests" 
                    value={stats.totalSrfs} 
                    description="Submitted SRFs" 
                    colorClass="bg-gradient-to-r from-blue-500 to-blue-600" 
                /> 
                <StatCard 
                    icon={<AlertCircle className="h-6 w-6" />} 
                    label="Active Deviations" 
                    value={stats.activeDeviations} 
                    description="Issues pending" 
                    colorClass="bg-gradient-to-r from-orange-500 to-red-500" 
                /> 
                <StatCard 
                    icon={<Award className="h-6 w-6" />} 
                    label="Ready Certificates" 
                    value={stats.readyCertificates} 
                    description="Download available" 
                    colorClass="bg-gradient-to-r from-green-500 to-emerald-600" 
                /> 
            </div> 

            {/* Quick Actions Grid */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-3">
                    Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ActionButton 
                        label="Track Status" 
                        description="Check status of equipment and SRFs" 
                        icon={<Activity className="h-8 w-8" />} 
                        onClick={() => navigate("/customer/track-status")}
                        colorClasses="bg-gradient-to-r from-blue-500 to-indigo-600"
                    />
                    <ActionButton 
                        label="Review FIRs" 
                        description="Approve inspection reports" 
                        icon={<Search className="h-8 w-8" />} 
                        onClick={() => navigate("/customer/view-firs")} 
                        colorClasses="bg-gradient-to-r from-cyan-500 to-blue-600"
                        badge={stats.firsForReview} 
                    />
                    <ActionButton 
                        label="View SRFs" 
                        description="Manage Service Request Forms" 
                        icon={<FileText className="h-8 w-8" />} 
                        onClick={() => navigate("/customer/view-srf")} 
                        colorClasses="bg-gradient-to-r from-green-500 to-emerald-600"
                        badge={stats.draftSrfs}
                    />
                    <ActionButton 
                        label="View Deviations" 
                        description="Access deviation reports" 
                        icon={<AlertTriangle className="h-8 w-8" />} 
                        badge={stats.activeDeviations} 
                        onClick={() => navigate("/customer/deviations")} 
                        colorClasses="bg-gradient-to-r from-orange-500 to-red-500"
                    />
                    <ActionButton 
                        label="Certificates" 
                        description="Generate and manage certificates" 
                        icon={<Award className="h-8 w-8" />} 
                        badge={stats.readyCertificates} 
                        onClick={() => navigate("/customer/certificates")} 
                        colorClasses="bg-gradient-to-r from-purple-500 to-indigo-600"
                    />
                     <ActionButton 
                        label="Export Data" 
                        description="Download records" 
                        icon={<Download className="h-8 w-8" />} 
                        onClick={() => console.log("Export Data clicked")} 
                        colorClasses="bg-gradient-to-r from-indigo-500 to-purple-600"
                    />
                </div>
            </div>
        </div> 
    );
};

// --- MAIN CUSTOMER PORTAL CONTAINER ---
const CustomerPortal: React.FC<DashboardProps> = ({ onLogout }) => {
    const { user } = useAuth();
    const [srfs, setSrfs] = useState<Srf[]>([]);
    const [firs, setFirs] = useState<FirForReview[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSrfs = useCallback(async () => {
        if (!user?.user_id) return;
        try {
            const response = await api.get<SrfApiResponse>('/portal/srfs');
            setSrfs([...(response.data.pending || []), ...(response.data.approved || []), ...(response.data.rejected || [])]);
        } catch (err) {
            console.error("[CustomerPortal] Failed to fetch SRFs:", err);
        }
    }, [user]);

    const fetchFirsForReview = useCallback(async () => {
        if (!user?.user_id) return;
        try {
            const response = await api.get<FirForReview[]>('/portal/firs-for-review');
            setFirs(response.data);
        } catch (err) {
            console.error("[CustomerPortal] Failed to fetch FIRs for review:", err);
        }
    }, [user]);

    useEffect(() => {
        const initialLoad = async () => {
            setLoading(true);
            await Promise.all([fetchSrfs(), fetchFirsForReview()]);
            setLoading(false);
        };
        initialLoad();
        const srfInterval = setInterval(fetchSrfs, 30000);
        const firInterval = setInterval(fetchFirsForReview, 30000);
        return () => {
            clearInterval(srfInterval);
            clearInterval(firInterval);
        };
    }, [fetchSrfs, fetchFirsForReview]);

    const handleStatusChange = (srfId: number, status: string) => {
        setSrfs((prev) => prev.map((srf) => (srf.srf_id === srfId ? { ...srf, status } as Srf : srf)));
    };

    const dashboardStats: DashboardStats = {
        totalSrfs: srfs.length,
        activeDeviations: 0, 
        readyCertificates: 0, 
        draftSrfs: srfs.filter((srf) => {
            const status = srf.status.toLowerCase();
            return status === "inward_completed" || status === "pending";
        }).length,
        firsForReview: firs.length,
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header onLogout={onLogout} username={user?.full_name || user?.username || "Customer"} role="Customer" />
            
            <main className="flex-1 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 w-full">
                {loading ? (
                    <DashboardSkeleton />
                ) : (
                    <Routes>
                        <Route path="/" element={<CustomerDashboardHome stats={dashboardStats} />} />
                        <Route path="track-status" element={<TrackStatusPage />} />
                        <Route path="view-srf" element={<CustomerSrfListView srfs={srfs as any[]} />} />
                        <Route path="srfs/:srfId" element={<CustomerSrfDetailView onStatusChange={handleStatusChange} />} />
                        <Route path="view-firs" element={<FirListView firs={firs} />} />
                        <Route path="fir-remarks/:inwardId" element={<CustomerRemarksPortal />} />
                        <Route path="deviations" element={<ViewDeviationsPage />} />
                        <Route path="certificates" element={<CertificatesPage />} />
                    </Routes>
                )}
            </main>
            
            <Footer />
        </div>
    );
};

export default CustomerPortal;