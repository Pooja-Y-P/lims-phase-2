import React, { useEffect, useState } from "react";
import { api, ENDPOINTS } from "../api/config";
import {
  Loader2,
  ClipboardList,
  ArrowLeft,
  Package,
  FileText,
  Calendar,
  User,
  Hash,
  AlertCircle,
  Play
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

// --- Interfaces ---

interface InwardJob {
  inward_id?: number;
  id?: number;        
  srf_no: string;
  customer_dc_no: string;
  customer_dc_date: string | null;
  status: string;
}

interface InwardEquipment {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  quantity: number;
  accessories_included: string | null;
  visual_inspection_notes: string | null;
}

interface InwardDetailResponse {
  inward_id: number;
  srf_no: string;
  material_inward_date: string;
  customer_dc_no: string;
  customer_dc_date: string;
  customer_details: string;
  equipments: InwardEquipment[];
}

const JobsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Hook to access the state passed from CalibrationPage

  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [jobs, setJobs] = useState<InwardJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<InwardDetailResponse | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  // --- NEW: Effect to restore Job Details View when returning from Calibration ---
  useEffect(() => {
    const state = location.state as { viewJobId?: number } | null;
    if (state?.viewJobId) {
        handleViewJob(state.viewJobId);
        // Optional: Clear state to prevent reopening on refresh if desired
        // window.history.replaceState({}, document.title);
    }
  }, [location]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await api.get<InwardJob[]>(`${ENDPOINTS.STAFF.INWARDS}`);
      const data = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setJobs(data);
    } catch (error) {
      console.error("Failed to fetch inward jobs", error);
      setErrorMsg("Failed to load jobs list.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewJob = async (id: number | undefined) => {
    if (!id) {
        // Only alert if manually clicked, not on auto-load
        if (viewMode === "list") alert("Error: Invalid Job ID");
        return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const url = `${ENDPOINTS.STAFF.INWARDS}/${id}`;
      const res = await api.get<InwardDetailResponse>(url);
      setSelectedJob(res.data);
      setViewMode("detail");
    } catch (error: any) {
      console.error("Failed to fetch job details:", error);
      if (error.response) {
        setErrorMsg(`Server Error: ${error.response.status} - Could not load details.`);
      } else {
        setErrorMsg("Network Error: Could not reach the server.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedJob(null);
    setErrorMsg(null);
    setViewMode("list");
  };

  const handleStartCalibration = (inwardId: number, equipmentId: number) => {
    navigate(`/engineer/calibration/${inwardId}/${equipmentId}`);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-GB", {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("complete") || s.includes("done")) return "bg-green-100 text-green-700";
    if (s.includes("progress")) return "bg-blue-100 text-blue-700";
    if (s.includes("wait") || s.includes("hold")) return "bg-orange-100 text-orange-700";
    return "bg-gray-100 text-gray-700";
  };

  if (loading && viewMode === 'list' && jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 min-h-[400px] flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // ==========================================
  // VIEW MODE: DETAIL (Shows Equipments)
  // ==========================================
  if (viewMode === "detail" && selectedJob) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-6">
        <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600 group-hover:text-blue-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Details</h1>
            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
              <Hash className="h-4 w-4" />
              <span className="font-mono">SRF: {selectedJob.srf_no}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
                <p className="font-medium text-gray-900 mt-1">{selectedJob.customer_details}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">DC Details</p>
                <p className="font-medium text-gray-900 mt-1">{selectedJob.customer_dc_no}</p>
                <p className="text-sm text-gray-500">{formatDate(selectedJob.customer_dc_date)}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-teal-100 text-teal-600 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Inward Date</p>
                <p className="font-medium text-gray-900 mt-1">{formatDate(selectedJob.material_inward_date)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-600" />
              <h3 className="font-bold text-gray-800">Equipments List</h3>
            </div>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
              Count: {selectedJob.equipments ? selectedJob.equipments.length : 0}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="px-6 py-3 font-semibold">NEPL ID</th>
                  <th className="px-6 py-3 font-semibold">Description</th>
                  <th className="px-6 py-3 font-semibold">Make</th>
                  <th className="px-6 py-3 font-semibold">Model</th>
                  <th className="px-6 py-3 font-semibold">Serial No</th>
                  <th className="px-6 py-3 font-semibold">Accessories</th>
                  <th className="px-6 py-3 font-semibold">Remarks</th>
                  <th className="px-6 py-3 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {selectedJob.equipments && selectedJob.equipments.map((item) => (
                  <tr key={item.inward_eqp_id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-blue-600">
                      {item.nepl_id}
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      {item.material_description}
                    </td>
                    <td className="px-6 py-4 text-gray-800">
                      {item.make}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {item.model}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono">
                      {item.serial_no}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {item.accessories_included || "-"}
                    </td>
                    <td className="px-6 py-4 text-gray-500 italic">
                      {item.visual_inspection_notes || "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                        <button
                            onClick={() => handleStartCalibration(selectedJob.inward_id, item.inward_eqp_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <Play className="h-3.5 w-3.5" />
                            Start Calibration
                        </button>
                    </td>
                  </tr>
                ))}
                {(!selectedJob.equipments || selectedJob.equipments.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                      No equipments found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- List View ---
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
       <div className="flex flex-wrap items-center justify-between border-b pb-6 mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl">
            <ClipboardList className="h-7 w-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Jobs Management
            </h2>
            <p className="text-gray-600 text-sm">
              Overview of Inwards, SRFs, and Customer DCs
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/engineer")}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
        >
          <ArrowLeft size={18} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {errorMsg && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{errorMsg}</span>
          </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          No jobs found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">SRF No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer DC No</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer DC Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.inward_id || job.id} className="border-t hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{job.srf_no || "-"}</td>
                  <td className="px-4 py-3 text-gray-700">{job.customer_dc_no || "-"}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{formatDate(job.customer_dc_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>{job.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewJob(job.inward_id || job.id)}
                      className="text-blue-600 font-semibold text-sm hover:underline flex items-center gap-1"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default JobsManagementPage;

