import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";
import { Srf } from "../types"; // Assuming your types file has the correct Srf interface

// This function will create the formatted reference number for display.
const generateNeplSrfNo = (srfNo: number | undefined): string => {
  if (!srfNo) return "N/A";
  const full = srfNo.toString();
  const lastThree = full.slice(-3).padStart(3, "0");
  return `NEPL - ${full} / SRF-${lastThree}`;
};

interface Props {
  srfs: Srf[];
}

const CustomerSrfListView: React.FC<Props> = ({ srfs }) => {
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");

  const filteredSrfs = srfs.filter((srf) => {
    if (activeTab === "pending") return srf.status === "inward_completed" || srf.status === "pending" || srf.status === 'created' || srf.status === 'in_progress';
    if (activeTab === "approved") return srf.status === "approved";
    if (activeTab === "rejected") return srf.status === "rejected";
    return false;
  });

  return (
    <div className="p-6 md:p-8 bg-white rounded-2xl shadow-lg border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-slate-800">View SRFs</h2>
        <Link
          to="/customer"
          className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {[
          { key: "pending", label: "Pending SRFs", icon: <Clock className="h-5 w-5" /> },
          { key: "approved", label: "Approved SRFs", icon: <CheckCircle2 className="h-5 w-5" /> },
          { key: "rejected", label: "Rejected SRFs", icon: <XCircle className="h-5 w-5" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b-2 -mb-px transition-all duration-150 ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600 font-semibold bg-indigo-50"
                : "border-transparent text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab(tab.key as any)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-slate-600 text-sm">
            <tr>
              <th className="p-4 font-semibold">Ref</th>
              <th className="p-4 font-semibold">Current Status</th>
              <th className="p-4 font-semibold">SRF Date</th>
              <th className="p-4 font-semibold">Customer Contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredSrfs.length > 0 ? (
              filteredSrfs.map((srf) => (
                <tr key={srf.srf_id} className="hover:bg-slate-50 transition-colors duration-150">
                  <td className="p-4 align-top">
                    <Link
                      to={`../srfs/${srf.srf_id}`}
                      className="text-indigo-600 font-medium hover:underline"
                    >
                      {generateNeplSrfNo(srf.srf_no)}
                    </Link>
                  </td>
                  <td className="p-4 align-top capitalize text-slate-700">
                    {srf.status.replace(/_/g, " ")}
                  </td>
                  {/* === THIS IS THE FIX === */}
                  <td className="p-4 align-top text-slate-600">
                    {new Date(srf.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 align-top text-slate-600">{srf.contact_person}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-12 text-slate-500 text-center">
                  No {activeTab} SRFs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerSrfListView;