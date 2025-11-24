import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";
 
interface Srf {
    srf_id: number;
    nepl_srf_no: string;
    status: string;
    date: string;
    created_at?: string; // Included to handle Date display safely
    inward?: {
        customer_dc_no?: string;
    };
}
 
const CustomerSrfListView: React.FC<{ srfs: Srf[] }> = ({ srfs }) => {
    const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
   
    const filteredSrfs = srfs.filter((srf) => {
        const status = srf.status.toLowerCase();
        return (
            // 'created' is removed from here as requested
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
                        <tr>
                            {/* Header changed to Customer DC No */}
                            <th className="p-4 font-semibold">Customer DC No</th>
                            <th className="p-4 font-semibold">Status</th>
                            <th className="p-4 font-semibold">Date</th>
                            <th className="p-4 font-semibold">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredSrfs.length > 0 ? (filteredSrfs.map((srf) => (
                            <tr key={srf.srf_id} className="hover:bg-slate-50">
                                {/* Data source changed to inward.customer_dc_no */}
                                <td className="p-4 align-top font-medium text-slate-800">
                                    {srf.inward?.customer_dc_no || "-"}
                                </td>
                                <td className="p-4 align-top capitalize text-slate-700">{srf.status.replace(/_/g, " ")}</td>
                                {/* Uses date or created_at to prevent Invalid Date error */}
                                <td className="p-4 align-top text-slate-600">
                                    {new Date(srf.date || srf.created_at || "").toLocaleDateString()}
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
 
export default CustomerSrfListView;
 