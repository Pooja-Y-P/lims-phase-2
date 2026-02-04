import React, { useState, useEffect, useCallback } from "react";
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
  X,
  Info,
  Clock
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from '../api/config';
import { CustomerRemarksPortal } from '../components/CustomerRemarksPortal';
import CustomerSrfDetailView from "../components/CustomerSrfDetailView"; 
import CustomerSrfListView from "../components/CustomerSrfListView";
// --- IMPORT THE NEW SEPARATE COMPONENT ---
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

// 1. Dismissible Portal Message Component
const PortalMessage: React.FC<{
    title: string;
    message: string;
    type?: 'warning' | 'info' | 'pending';
    actionLabel?: string;
    onAction?: () => void;
}> = ({ title, message, type = 'warning', actionLabel, onAction }) => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    let styles = { bg: '', border: '', textTitle: '', textBody: '', btnBg: '', icon: <div /> };
    
    switch (type) {
        case 'warning':
            styles = { bg: 'bg-orange-50', border: 'border-orange-200', textTitle: 'text-orange-900', textBody: 'text-orange-800', btnBg: 'bg-orange-600 hover:bg-orange-700', icon: <AlertTriangle className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" /> };
            break;
        case 'pending': 
            styles = { bg: 'bg-yellow-50', border: 'border-yellow-200', textTitle: 'text-yellow-900', textBody: 'text-yellow-800', btnBg: 'bg-yellow-600 hover:bg-yellow-700', icon: <Clock className="h-6 w-6 text-yellow-600 mt-1 flex-shrink-0" /> };
            break;
        case 'info':
        default:
            styles = { bg: 'bg-blue-50', border: 'border-blue-200', textTitle: 'text-blue-900', textBody: 'text-blue-800', btnBg: 'bg-blue-600 hover:bg-blue-700', icon: <Info className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" /> };
            break;
    }

    return (
        <div className={`${styles.bg} border ${styles.border} rounded-xl p-6 mb-4 shadow-sm relative transition-all duration-300`}>
            <button 
                onClick={() => setIsVisible(false)}
                className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
                aria-label="Dismiss message"
            >
                <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4 pr-8">
                {styles.icon}
                <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${styles.textTitle} mb-1`}>{title}</h3>
                    <p className={`${styles.textBody} text-sm mb-3`}>{message}</p>
                    {actionLabel && onAction && (
                        <button 
                            onClick={onAction}
                            className={`${styles.btnBg} text-white px-4 py-2 rounded-lg font-semibold transition-colors text-sm`}
                        >
                            {actionLabel}
                        </button>
                    )}
                </div>
            </div>
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
            {/* Header Section */}
            <div className="flex items-center gap-4 mb-8"> 
                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg">
                    <ClipboardList className="h-10 w-10 text-white" />
                </div> 
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Customer Portal</h1> 
                    <p className="mt-1 text-base text-gray-600">Welcome back, {user?.full_name || user?.username || "Customer"}</p>
                </div> 
            </div> 

            {/* --- NOTIFICATIONS SECTION --- */}
            {stats.firsForReview > 0 && (
                <PortalMessage 
                    type="warning"
                    title="Action Required"
                    message={`You have ${stats.firsForReview} First Inspection Report(s) awaiting your review.`}
                    actionLabel="Review Reports"
                    onAction={() => navigate('/customer/view-firs')}
                />
            )}
            
            {stats.draftSrfs > 0 && (
                <PortalMessage 
                    type="pending"
                    title="Approval Pending"
                    message={`You have ${stats.draftSrfs} pending Service Request Form(s) for approval.`}
                    actionLabel="View SRFs"
                    onAction={() => navigate('/customer/view-srf')}
                />
            )}

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

    if (loading) return <div className="p-8 text-lg text-center text-gray-500">Loading your portal...</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header onLogout={onLogout} username={user?.full_name || user?.username || "Customer"} role="Customer" />
            
            <main className="flex-1 max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 w-full">
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
            </main>
            
            <Footer />
        </div>
    );
};

export default CustomerPortal;