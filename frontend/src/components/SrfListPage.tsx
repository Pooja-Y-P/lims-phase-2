import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Inbox, ChevronRight, ArrowLeft, Clock, Edit3, Download, Search, Filter, X } from "lucide-react";
import { api, ENDPOINTS } from "../api/config";
 
// Interface for inwards that are ready for SRF creation
interface PendingInward {
  inward_id: number;
  srf_no: number;
  customer_name: string | null;
  date: string;
  status: "updated";
}
 
// Interface for existing SRF documents
interface SrfSummary {
  srf_id: number;
  srf_no: string; // Changed to string to handle NEPL...
  customer_name: string | null;
  date: string;
  // Updated to include all possible statuses
  status: "draft" | "inward_completed" | "generated" | "approved" | "rejected" | null;
}
 
// A unified interface for items displayed in the list
interface WorkItem {
  id: number;
  type: "inward" | "srf";
  displayNumber: string;
  customer_name: string | null;
  date: string;
  status: "pending_creation" | "customer_review" | "approved" | "rejected";
  isDraft?: boolean; // Helper to show a "Draft" badge
}
 
const STATUS_KEYS = {
  PENDING: "pending_creation",
  REVIEW: "customer_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
 
type StatusKey = (typeof STATUS_KEYS)[keyof typeof STATUS_KEYS];
 
export const SrfListPage: React.FC = () => {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<StatusKey>(STATUS_KEYS.PENDING);
  const navigate = useNavigate();
  
  // Filter states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  
  // Helper function to format date for input
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
 
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
 
      try {
        const inwardsResponse = await api.get<PendingInward[]>(
          `${ENDPOINTS.STAFF.INWARDS}/updated`
        );
        const srfsResponse = await api.get<SrfSummary[]>(`${ENDPOINTS.SRFS}`);
 
        // 1. Map Fresh Inwards (Never created) -> Pending Tab
        const pendingItems: WorkItem[] = inwardsResponse.data.map((inward) => ({
          id: inward.inward_id,
          type: "inward",
          displayNumber: `SRF No: ${inward.srf_no}`,
          customer_name: inward.customer_name,
          date: inward.date,
          status: STATUS_KEYS.PENDING,
          isDraft: false,
        }));
 
        // 2. Map Existing SRFs based on status
        const srfItems = srfsResponse.data
          .map((srf): WorkItem | null => {
            let workItemStatus: StatusKey | null = null;
            let isDraft = false;
 
            // --- LOGIC CHANGE HERE ---
            if (srf.status === "draft") {
              // Drafts go to PENDING tab
              workItemStatus = STATUS_KEYS.PENDING;
              isDraft = true;
            } else if (
              srf.status === "inward_completed" ||
              srf.status === "generated"
            ) {
              // Completed forms go to REVIEW tab
              workItemStatus = STATUS_KEYS.REVIEW;
            } else if (srf.status === "approved") {
              workItemStatus = STATUS_KEYS.APPROVED;
            } else if (srf.status === "rejected") {
              workItemStatus = STATUS_KEYS.REJECTED;
            }
 
            if (workItemStatus) {
              return {
                id: srf.srf_id,
                type: "srf" as const,
                displayNumber: `SRF No: ${srf.srf_no}`,
                customer_name: srf.customer_name,
                date: srf.date,
                status: workItemStatus,
                isDraft: isDraft,
              };
            }
            return null;
          })
          .filter((item): item is WorkItem => item !== null);
 
        // Combine both lists
        // Note: You might want to filter pendingItems to remove duplicates if the backend
        // returns an Inward even after an SRF is created.
        // For now, we assume backend filters them, or we simply display both.
        setWorkItems([...pendingItems, ...srfItems]);
      } catch (err: any) {
        console.error("Failed to fetch data:", err);
        setError(
          err.response?.data?.detail ||
            err.message ||
            "Could not load data. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };
 
    fetchAllData();
  }, []);
 
  const statuses: StatusKey[] = [
    STATUS_KEYS.PENDING,
    STATUS_KEYS.REVIEW,
    STATUS_KEYS.APPROVED,
    STATUS_KEYS.REJECTED,
  ];
 
  const groupedWorkItems = workItems.reduce(
    (groups: Partial<Record<StatusKey, WorkItem[]>>, item) => {
      if (!groups[item.status]) {
        groups[item.status] = [];
      }
      groups[item.status]!.push(item);
      return groups;
    },
    {}
  );

  // Apply filters to current tab items
  const filteredWorkItems = useMemo(() => {
    const items = groupedWorkItems[activeTab] || [];
    let filtered = items;
    
    // Date filter
    if (startDate || endDate) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date);
        if (startDate && itemDate < new Date(startDate)) return false;
        if (endDate && itemDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const searchableText = `${item.displayNumber} ${item.customer_name || ""}`.toLowerCase();
        return searchableText.includes(searchLower);
      });
    }
    
    return filtered;
  }, [groupedWorkItems, activeTab, startDate, endDate, searchTerm]);

  const currentWorkItems = filteredWorkItems;
  
  // Export handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);
      if (searchTerm) params.append("search", searchTerm);
      
      let endpoint = "";
      const basePath = ENDPOINTS.SRFS.endsWith('/') ? ENDPOINTS.SRFS.slice(0, -1) : ENDPOINTS.SRFS;
      if (activeTab === STATUS_KEYS.PENDING) {
        endpoint = `${basePath}/export/pending?${params.toString()}`;
      } else {
        endpoint = `${basePath}/export/${activeTab}?${params.toString()}`;
      }
      
      const response = await api.get(endpoint, { responseType: "blob" });
      
      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || 
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      link.href = url;
      link.download = `srf_${activeTab}_export_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };
  
  const resetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
  };
  
  const hasActiveFilters = startDate || endDate || searchTerm;
 
  const statusLabels: Record<StatusKey, string> = {
    [STATUS_KEYS.PENDING]: "Pending SRF Creation",
    [STATUS_KEYS.REVIEW]: "Customer Review Pending",
    [STATUS_KEYS.APPROVED]: "Approved",
    [STATUS_KEYS.REJECTED]: "Rejected",
  };
 
  const tabColors: Record<StatusKey, string> = {
    [STATUS_KEYS.PENDING]: "text-yellow-600 border-yellow-500",
    [STATUS_KEYS.REVIEW]: "text-blue-600 border-blue-500",
    [STATUS_KEYS.APPROVED]: "text-green-600 border-green-500",
    [STATUS_KEYS.REJECTED]: "text-red-600 border-red-500",
  };
 
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center text-gray-600 text-lg">Loading Data...</div>
      </div>
    );
 
  if (error)
    return (
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center text-red-600 bg-white p-6 rounded-xl shadow-md border border-red-200">
          {error}
        </div>
      </div>
    );
 
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-10">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
       
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8 border-b pb-5">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-gray-800">
                SRF Status Overview
              </h1>
              <p className="text-sm text-gray-500">
                Create new SRFs and track the status of existing ones.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/engineer")}
            className="flex-shrink-0 flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
          >
            <ArrowLeft size={18} />
            <span>Back to Dashboard</span>
          </button>
        </div>
 
        {/* Tabs */}
        <div className="flex flex-wrap gap-3 border-b border-gray-200 mb-6">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`px-5 py-2.5 font-medium text-sm rounded-t-md border-b-2 transition-all duration-200 ${
                activeTab === status
                  ? `${tabColors[status]} bg-blue-50`
                  : "text-gray-500 border-transparent hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              {statusLabels[status]}
              <span className="ml-1 text-gray-400 font-normal">
                ({(groupedWorkItems[status] || []).length})
              </span>
            </button>
          ))}
        </div>

        {/* Filters and Export Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by SRF No or Customer..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={isExporting || currentWorkItems.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting..." : "Export"}
              </button>
            </div>
          </div>
          
          {/* Filter Summary */}
          {hasActiveFilters && (
            <div className="mt-3 text-sm text-gray-600">
              Showing {currentWorkItems.length} of {(groupedWorkItems[activeTab] || []).length} items
              {searchTerm && ` matching "${searchTerm}"`}
            </div>
          )}
        </div>
 
        {/* List */}
        <div className="space-y-3">
          {currentWorkItems.length > 0 ? (
            currentWorkItems.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                // If it's an inward (type='inward'), go to new-...
                // If it's an SRF (type='srf'), go to normal ID
                to={
                  item.type === "inward"
                    ? `/engineer/srfs/new-${item.id}`
                    : `/engineer/srfs/${item.id}`
                }
                className="flex items-center justify-between p-5 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-xl transition-all duration-200 group shadow-sm hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  {/* Icon differentiating fresh inward vs draft srf */}
                  <div className="mt-1">
                    {item.isDraft ? (
                       <div title="Draft in Progress" className="bg-yellow-100 p-2 rounded-full text-yellow-600">
                          <Edit3 size={20} />
                       </div>
                    ) : (
                       <div title="New Request" className="bg-blue-100 p-2 rounded-full text-blue-600">
                          <Clock size={20} />
                       </div>
                    )}
                  </div>
                 
                  <div>
                    <div className="flex items-center gap-3">
                        <p className="font-semibold text-lg text-gray-800">
                        {item.displayNumber}
                        </p>
                        {item.isDraft && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full font-medium">
                                Draft
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.customer_name || "N/A"} — Received on{" "}
                      <span className="font-medium text-gray-700">
                        {new Date(item.date).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </Link>
            ))
          ) : (
            <div className="text-center text-gray-500 py-20">
              <Inbox className="h-16 w-16 mx-auto text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold">No Items Found</h3>
              <p className="text-gray-600">
                There are no items under{" "}
                <span className="font-medium">
                  {statusLabels[activeTab]}
                </span>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
 
export default SrfListPage;