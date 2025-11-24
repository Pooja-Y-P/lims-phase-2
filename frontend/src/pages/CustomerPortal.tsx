import React, { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Srf, DashboardProps } from "../types";
import {
  AlertCircle,
  Award,
  ClipboardList,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  FileText,
  AlertTriangle,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from '../api/config';
import { CustomerRemarksPortal } from '../components/CustomerRemarksPortal';
import CustomerSrfDetailView from "../components/CustomerSrfDetailView"; 

// --- LOCAL TYPE DEFINITIONS ---
interface FirForReview {
  inward_id: number;
  srf_no: string;
  // Updated interface to allow optional or multiple date fields
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

// --- FIR List View Component ---
const FirListView: React.FC<{ firs: FirForReview[] }> = ({ firs }) => {
    return (
        <div className="p-6 md:p-8 bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                    <FileText className="h-8 w-8 text-orange-600" />
                    First Inspection Reports (FIRs)
                </h2>
                <Link to="/customer" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                </Link>
            </div>
            <div className="mb-6 p-4 bg-orange-50 border-l-4 border-orange-400 rounded-r-lg">
                <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 mr-3" />
                    <div>
                        <h3 className="text-sm font-medium text-orange-800">Action Required</h3>
                        <p className="mt-1 text-sm text-orange-700">The following inwards have completed first inspection. Please review and provide your feedback.</p>
                    </div>
                </div>
            </div>
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
                                        <AlertTriangle className="h-3 w-3" /> Requires Your Review
                                    </span>
                                </td>
                                <td className="p-4 align-top text-slate-600">
                                    {/* Use helper to format either material_inward_date or date */}
                                    {formatSafeDate(fir.material_inward_date || fir.date)}
                                </td>
                                <td className="p-4 align-top">
                                    <Link to={`/customer/fir-remarks/${fir.inward_id}`} className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 text-sm transition-colors">
                                        <FileText className="h-4 w-4" /> Review & Add Remarks
                                    </Link>
                                </td>
                            </tr>
                        ))) : (
                            <tr>
                                <td colSpan={4} className="p-12 text-slate-500 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <CheckCircle2 className="h-12 w-12 text-green-400" />
                                        <h3 className="text-lg font-medium">All Caught Up!</h3>
                                        <p className="text-sm">No FIRs are currently waiting for your remarks.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- SRF List View Component ---
const CustomerSrfListView: React.FC<{ srfs: Srf[] }> = ({ srfs }) => {
    const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
    const filteredSrfs = srfs.filter((srf) => {
        const status = srf.status.toLowerCase();
        return (
            (activeTab === "pending" && (status.includes("inward") || status.includes("pending") || status.includes("reviewed") || status.includes("updated"))) ||
            (activeTab === "approved" && status === "approved") ||
            (activeTab === "rejected" && status === "rejected")
        );
    });
    return (
        <div className="p-6 md:p-8 bg-white rounded-2xl shadow-lg border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-slate-800">View Service Request Forms (SRFs)</h2>
                <Link to="/customer" className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                </Link>
            </div>
            <div className="flex gap-1 border-b border-slate-200 mb-6">
                {[{ key: "pending", label: "Pending for Approval", icon: <Clock className="h-5 w-5" /> }, { key: "approved", label: "Approved SRFs", icon: <CheckCircle2 className="h-5 w-5" /> }, { key: "rejected", label: "Rejected SRFs", icon: <XCircle className="h-5 w-5" /> }].map((tab) => (
                    <button key={tab.key} className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b-2 -mb-px transition-all ${activeTab === tab.key ? "border-indigo-600 text-indigo-600 font-semibold bg-indigo-50" : "border-transparent text-slate-600 hover:text-indigo-600 hover:bg-slate-50"}`} onClick={() => setActiveTab(tab.key as any)}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-600 text-sm">
                        <tr><th className="p-4 font-semibold">Ref</th><th className="p-4 font-semibold">Status</th><th className="p-4 font-semibold">Date</th><th className="p-4 font-semibold">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredSrfs.length > 0 ? (filteredSrfs.map((srf) => (
                            <tr key={srf.srf_id} className="hover:bg-slate-50">
                                <td className="p-4 align-top font-medium text-slate-800">{srf.nepl_srf_no}</td>
                                <td className="p-4 align-top capitalize text-slate-700">{srf.status.replace(/_/g, " ")}</td>
                                <td className="p-4 align-top text-slate-600">
                                     {/* Use helper to format date */}
                                    {formatSafeDate(srf.date)}
                                </td>
                                <td className="p-4 align-top">
                                    <Link to={`/customer/srfs/${srf.srf_id}`} className="text-indigo-600 font-semibold hover:underline">View & Approve</Link>
                                </td>
                            </tr>
                        ))) : (<tr><td colSpan={4} className="p-12 text-slate-500 text-center">No {activeTab} SRFs found.</td></tr>)}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Sub-pages ---
const ViewDeviationsPage = () => <div className="p-8 bg-white rounded-2xl shadow-md"><h2 className="text-3xl font-semibold">View Deviations</h2><Link to="/customer">&larr; Back to Dashboard</Link></div>;
const CertificatesPage = () => <div className="p-8 bg-white rounded-2xl shadow-md"><h2 className="text-3xl font-semibold">Certificates</h2><Link to="/customer">&larr; Back to Dashboard</Link></div>;

// --- Dashboard UI Components ---
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; description: string; gradient: string; bgGradient: string; }> = ({ icon, label, value, description, gradient, bgGradient }) => ( 
    <div className={`relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl group`}> 
        <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity`} /> 
        <div className="relative z-10"> 
            <div className="flex items-start justify-between mb-6"> 
                <div className={`p-4 bg-gradient-to-r ${gradient} rounded-xl text-white shadow-lg`}>{icon}</div> 
                <div className="text-4xl font-bold text-gray-900 group-hover:text-white">{value}</div> 
            </div> 
            <div> 
                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-white">{label}</h3> 
                <p className="text-gray-600 group-hover:text-gray-100 text-sm">{description}</p> 
            </div> 
        </div> 
    </div> 
);

const ActionButton: React.FC<{ color: string; label: string; description: string; icon: React.ReactNode; onClick: () => void; badgeCount?: number; }> = ({ color, label, description, icon, onClick, badgeCount }) => ( 
    <button onClick={onClick} className="relative group bg-white border rounded-xl p-6 hover:shadow-lg text-left transition-all"> 
        <div className={`inline-flex p-3 bg-gradient-to-r ${color} rounded-xl text-white mb-4`}>{icon}</div> 
        <h3 className="font-semibold text-lg">{label}</h3> 
        <p className="text-sm">{description}</p> 
        {badgeCount && badgeCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full px-2 text-xs font-bold">{badgeCount}</span>} 
    </button> 
);

const QuickActions: React.FC<{ onSelect: (path: string) => void; stats: DashboardStats }> = ({ onSelect, stats }) => (
    <div className="bg-white rounded-2xl shadow-lg border">
        <div className="px-8 py-6 bg-gradient-to-r from-indigo-600 to-blue-600"> 
            <h2 className="text-2xl font-bold text-white">Quick Actions</h2> 
            <p className="text-indigo-100 mt-1">Choose an action</p> 
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <ActionButton color="from-orange-500 to-red-500" label="Review FIRs" description="Add remarks to inspection reports" icon={<FileText className="h-8 w-8" />} onClick={() => onSelect("/customer/view-firs")} badgeCount={stats.firsForReview} />
            <ActionButton color="from-blue-500 to-indigo-600" label="View SRFs" description="Approve or reject SRFs" icon={<ClipboardList className="h-8 w-8" />} badgeCount={stats.draftSrfs} onClick={() => onSelect("/customer/view-srf")} />
            <ActionButton color="from-yellow-500 to-amber-500" label="View Deviations" description="Track active issues" icon={<AlertCircle className="h-8 w-8" />} badgeCount={stats.activeDeviations} onClick={() => onSelect("/customer/deviations")} />
            <ActionButton color="from-green-500 to-emerald-600" label="Certificates" description="Download certificates" icon={<Award className="h-8 w-8" />} badgeCount={stats.readyCertificates} onClick={() => onSelect("/customer/certificates")} />
        </div>
    </div>
);

const CustomerDashboardHome: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    return ( 
        <div className="min-h-full bg-gradient-to-br from-blue-50 via-white to-indigo-50"> 
            <div className="max-w-7xl mx-auto py-8 px-4"> 
                <div className="flex items-center gap-6 mb-12"> 
                    <div className="p-3 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-2xl shadow-lg"><ClipboardList className="h-10 w-10 text-white" /></div> 
                    <div><h1 className="text-4xl font-bold">Customer Portal</h1> <p className="text-lg text-gray-600 mt-1">Welcome back, {user?.full_name || "Customer"}</p></div> 
                </div> 
                {stats.firsForReview > 0 && (
                    <div className="mb-6 p-4 bg-orange-100 text-orange-800 rounded-lg flex items-center gap-3 border border-orange-200">
                        <AlertTriangle className="h-6 w-6 text-orange-600" /> 
                        <div>
                            <p className="font-semibold">Action Required: You have <span className="font-bold">{stats.firsForReview}</span> First Inspection Report(s) awaiting your review.</p>
                            <p className="text-sm">Please review and provide remarks for equipment with deviations to proceed with calibration.</p>
                        </div>
                    </div>
                )}
                {stats.draftSrfs > 0 && (
                    <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 rounded-lg flex items-center gap-3 border border-yellow-200">
                        <Clock className="h-6 w-6" /> 
                        <p>You have <span className="font-semibold">{stats.draftSrfs}</span> pending Service Request Form(s) for approval.</p>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"> 
                    <StatCard icon={<Activity className="h-10 w-10" />} label="Total Service Requests" value={stats.totalSrfs} description="Submitted SRFs" gradient="from-blue-500 to-blue-600" bgGradient="from-blue-50 to-blue-100" /> 
                    <StatCard icon={<AlertCircle className="h-10 w-10" />} label="Active Deviations" value={stats.activeDeviations} description="Issues requiring attention" gradient="from-orange-500 to-red-500" bgGradient="from-orange-50 to-red-50" /> 
                    <StatCard icon={<Award className="h-10 w-10" />} label="Ready Certificates" value={stats.readyCertificates} description="Available for download" gradient="from-green-500 to-emerald-600" bgGradient="from-green-50 to-emerald-50" /> 
                </div> 
                <QuickActions onSelect={navigate} stats={stats} /> 
            </div> 
        </div> 
    );
};

// --- Customer Portal Main Container ---
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
        draftSrfs: srfs.filter((srf) => srf.status === "inward_completed" || srf.status === "pending").length,
        firsForReview: firs.length,
    };

    if (loading) return <div className="p-8 text-lg text-center">Loading...</div>;

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            <Header onLogout={onLogout} username={user?.full_name || user?.username || "Customer"} role="Customer" />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">
                <Routes>
                    <Route path="/" element={<CustomerDashboardHome stats={dashboardStats} />} />
                    <Route path="view-srf" element={<CustomerSrfListView srfs={srfs} />} />
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