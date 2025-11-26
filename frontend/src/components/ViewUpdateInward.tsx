import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Eye, 
  Edit, 
  Printer, 
  Search, 
  Calendar, 
  Building, 
  FileText,
  Loader2,
  ArrowLeft,
  Filter,
  SortAsc,
  SortDesc,
  Download
} from "lucide-react";
import { api, ENDPOINTS } from "../api/config";
import { InwardDetail } from "../types/inward";

interface ViewUpdateInwardProps {}

export const ViewUpdateInward: React.FC<ViewUpdateInwardProps> = () => {
  const navigate = useNavigate();
  const [inwards, setInwards] = useState<InwardDetail[]>([]);
  const [filteredInwards, setFilteredInwards] = useState<InwardDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<keyof InwardDetail>("material_inward_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchInwards();
  }, []);

  useEffect(() => {
    filterAndSortInwards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inwards, searchTerm, statusFilter, sortField, sortOrder, startDate, endDate]);

  const fetchInwards = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<InwardDetail[]>(ENDPOINTS.STAFF.INWARDS);
      setInwards(response.data);
    } catch (error) {
      console.error("Error fetching inwards:", error);
      setError("Failed to load inward records. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortInwards = () => {
    let filtered = inwards.filter(inward => {
      const searchTermLower = searchTerm.toLowerCase();
      
      // Safely access properties that might be null/undefined
      const srfNoString = inward.srf_no?.toString().toLowerCase() ?? '';
      const customerDetailsString = inward.customer_details?.toLowerCase() ?? '';
      // --- NEW: Add DC Number to search logic ---
      const dcNoString = inward.customer_dc_no?.toString().toLowerCase() ?? '';

      const matchesSearch = 
        srfNoString.includes(searchTermLower) ||
        customerDetailsString.includes(searchTermLower) ||
        dcNoString.includes(searchTermLower); // Check against DC Number
      
      const matchesStatus = statusFilter === "all" || inward.status === statusFilter;
      
      // Date filtering
      let matchesDate = true;
      if (startDate || endDate) {
        const inwardDate = new Date(inward.material_inward_date);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (inwardDate < start) {
            matchesDate = false;
          }
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (inwardDate > end) {
            matchesDate = false;
          }
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });

    // Safely sort the filtered array
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      // Handle null or undefined values
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      let comparison = 0;
      if (sortField === 'material_inward_date') {
        comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
      } else {
        if (aValue < bValue) {
          comparison = -1;
        } else if (aValue > bValue) {
          comparison = 1;
        }
      }

      return sortOrder === 'desc' ? comparison * -1 : comparison;
    });

    setFilteredInwards(filtered);
  };

  const handleSort = (field: keyof InwardDetail) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleViewInward = (inwardId: number) => {
    navigate(`/engineer/view-inward/${inwardId}`);
  };

  const handleEditInward = (inwardId: number) => {
    navigate(`/engineer/edit-inward/${inwardId}`);
  };

  const handlePrintStickers = (inwardId: number) => {
    navigate(`/engineer/print-stickers/${inwardId}`);
  };

  const handleExportToExcel = async () => {
    if (filteredInwards.length === 0) {
      alert("No inwards to export. Please adjust your filters.");
      return;
    }

    setIsExporting(true);
    try {
      const inwardIds = filteredInwards.map(inward => inward.inward_id);
      const response = await api.post(
        ENDPOINTS.STAFF.INWARD_EXPORT_BATCH_INWARD_ONLY,
        { inward_ids: inwardIds },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || 
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      link.href = url;
      link.download = `inwards_export_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export inwards:", error);
      alert("Failed to export inwards. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "created": return "bg-blue-100 text-blue-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const SortIcon = ({ field }: { field: keyof InwardDetail }) => {
    if (sortField !== field) return <SortAsc className="w-4 h-4 text-gray-400" />;
    return sortOrder === "asc" ? 
      <SortAsc className="w-4 h-4 text-blue-600" /> : 
      <SortDesc className="w-4 h-4 text-blue-600" />;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <span className="ml-3 text-lg text-gray-600">Loading inward records...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchInwards}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">View & Update Inward</h1>
            <p className="text-gray-600">Manage existing inward records</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/engineer')}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
        >
          <ArrowLeft size={20} />
          <span>Back to Portal</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              // --- UPDATE: Placeholder text ---
              placeholder="Search by SRF, Customer or DC No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">All Status</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="reviewed">Reviewed</option>
              
            </select>
          </div>

          <div className="text-right self-center">
            <span className="text-sm text-gray-600">
              Showing {filteredInwards.length} of {inwards.length} records
            </span>
          </div>
        </div>

        {/* Date Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="date"
              placeholder="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="date"
              placeholder="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportToExcel}
              disabled={isExporting || filteredInwards.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {isExporting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Export to Excel</span>
                </>
              )}
            </button>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inward Records Table */}
      <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="p-4 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("srf_no")}
              >
                <div className="flex items-center gap-2">
                  SRF No
                  <SortIcon field="srf_no" />
                </div>
              </th>
              <th 
                className="p-4 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("material_inward_date")}
              >
                <div className="flex items-center gap-2">
                  Date
                  <SortIcon field="material_inward_date" />
                </div>
              </th>
              <th 
                className="p-4 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("customer_details")}
              >
                <div className="flex items-center gap-2">
                  Customer
                  <SortIcon field="customer_details" />
                </div>
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Equipment Count
              </th>
              <th 
                className="p-4 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-2">
                  Status
                  <SortIcon field="status" />
                </div>
              </th>
              <th className="p-4 text-center text-xs font-semibold text-gray-600 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInwards.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  {searchTerm || statusFilter !== "all" ? "No records match your filters" : "No inward records found"}
                </td>
              </tr>
            ) : (
              filteredInwards.map((inward) => (
                <tr key={inward.inward_id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-mono font-bold text-blue-600">
                      {inward.srf_no}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>{new Date(inward.material_inward_date).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-start gap-2">
                      <Building className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-gray-800 line-clamp-2">{inward.customer_details}</span>
                        {/* --- NEW: Display DC Number in table --- */}
                        {inward.customer_dc_no && (
                           <span className="text-xs text-gray-500">DC: {inward.customer_dc_no}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                      {inward.equipments ? inward.equipments.length : 0}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${getStatusColor(inward.status)}`}>
                      {inward.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewInward(inward.inward_id)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
                        title="View Inward Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEditInward(inward.inward_id)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-full transition-colors"
                        title="Edit Inward"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handlePrintStickers(inward.inward_id)}
                        className="p-2 text-purple-600 hover:bg-purple-100 rounded-full transition-colors"
                        title="Print Stickers"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {inwards.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{inwards.length}</div>
            <div className="text-sm text-gray-600">Total Inwards</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {inwards.filter(i => i.status === 'created').length}
            </div>
            <div className="text-sm text-gray-600">Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {inwards.filter(i => i.status === 'reviewed').length}
            </div>
            <div className="text-sm text-gray-600">Reviewed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {inwards.filter(i => i.status === 'updated').length}
            </div>
            <div className="text-sm text-gray-600">Updated</div>
          </div>
        </div>
      )}
    </div>
  );
};