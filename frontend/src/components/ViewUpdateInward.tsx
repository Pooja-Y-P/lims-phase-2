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
  Download,
  FileDown, 
  CheckSquare,
  Square,
  RefreshCw
} from "lucide-react";
import { api, ENDPOINTS } from "../api/config";
import { InwardDetail } from "../types/inward";
// Ensure this path matches where you saved the helper file from the previous step
import { generateStandardInwardPDF } from '../utils/InwardPDFHelper';

export const ViewUpdateInward: React.FC = () => {
  const navigate = useNavigate();
  
  // --- State Management ---
  const [inwards, setInwards] = useState<InwardDetail[]>([]);
  const [filteredInwards, setFilteredInwards] = useState<InwardDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter/Sort States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<keyof InwardDetail>("material_inward_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Action States
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // --- Effects ---
  useEffect(() => {
    fetchInwards();
  }, []);

  useEffect(() => {
    filterAndSortInwards();
    // Optional: Clear selection when filters change to avoid confusion
    // setSelectedIds([]); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inwards, searchTerm, statusFilter, sortField, sortOrder, startDate, endDate]);

  // --- Data Fetching ---
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

  // --- Filtering & Sorting Logic ---
  const filterAndSortInwards = () => {
    let filtered = inwards.filter(inward => {
      const searchTermLower = searchTerm.toLowerCase();
      
      const srfNoString = inward.srf_no?.toString().toLowerCase() ?? '';
      const customerDetailsString = inward.customer_details?.toLowerCase() ?? '';
      const dcNoString = (inward as any).customer_dc_no?.toString().toLowerCase() ?? '';

      const matchesSearch = 
        srfNoString.includes(searchTermLower) ||
        customerDetailsString.includes(searchTermLower) ||
        dcNoString.includes(searchTermLower);
      
      const currentStatus = inward.status?.toLowerCase() || '';
      const matchesStatus = 
        statusFilter === "all" || 
        currentStatus === statusFilter.toLowerCase();
      
      let matchesDate = true;
      if (startDate || endDate) {
        const inwardDate = new Date(inward.material_inward_date);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (inwardDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (inwardDate > end) matchesDate = false;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });

    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      let comparison = 0;
      if (sortField === 'material_inward_date') {
        comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
      } else {
        if (aValue < bValue) comparison = -1;
        else if (aValue > bValue) comparison = 1;
      }

      return sortOrder === 'desc' ? comparison * -1 : comparison;
    });

    setFilteredInwards(filtered);
  };

  // --- Selection Handlers ---
  const handleSelectAll = () => {
    if (selectedIds.length === filteredInwards.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInwards.map(i => i.inward_id));
    }
  };

  const handleSelectRow = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // --- Action Handlers (PDF & Excel) ---

  const handleDownloadSelectedPDFs = async () => {
    if (selectedIds.length === 0) {
      alert("Please select at least one record to download.");
      return;
    }

    setIsDownloadingPdf(true);
    
    try {
      // Iterate through selected IDs one by one
      for (const id of selectedIds) {
        try {
          // 1. Fetch FULL DETAILS for the specific ID to ensure we have equipment list
          // (The list view API usually returns summary data, we need detailed equipment data)
          const response = await api.get<InwardDetail>(`${ENDPOINTS.STAFF.INWARDS}/${id}`);
          const fullInwardData = response.data;

          if (fullInwardData) {
            // 2. Prepare basic form data including customer details from nested customer object
            const customerData = (fullInwardData as any).customer;
            const pdfFormData = {
              srf_no: fullInwardData.srf_no,
              material_inward_date: fullInwardData.material_inward_date,
              receiver: fullInwardData.receiver || '',
              customer_details: fullInwardData.customer_details,
              customer_dc_no: (fullInwardData as any).customer_dc_no || '',
              customer_dc_date: (fullInwardData as any).customer_dc_date || '',
              // Extract customer contact details and addresses from nested customer object
              contact_person: customerData?.contact_person || '',
              phone: customerData?.phone || '',
              email: customerData?.email || '',
              ship_to_address: customerData?.ship_to_address || '',
              bill_to_address: customerData?.bill_to_address || ''
            };

            // 3. Map Equipment List to the format expected by the PDF generator
            // Note: We map DB fields (like visual_inspection_notes) to UI fields (inspe_status)
            const formattedEquipment = (fullInwardData.equipments || []).map((eq: any, index: number) => ({
              nepl_id: `${fullInwardData.srf_no}-${index + 1}`,
              material_desc: eq.material_description,
              make: eq.make,
              model: eq.model,
              serial_no: eq.serial_no,
              range: eq.range,
              qty: eq.quantity, 
              supplier: eq.supplier,
              in_dc: eq.in_dc,
              out_dc: eq.out_dc,
              calibration_by: eq.calibration_by,
              nextage_ref: eq.nextage_contract_reference,
              accessories_included: eq.accessories_included,
              inspe_status: eq.visual_inspection_notes, // Mapping backend -> PDF expected key
              engineer_remarks: eq.engineer_remarks,
              remarks_and_decision: eq.customer_remarks
            }));

            // 4. Generate the PDF
            generateStandardInwardPDF(pdfFormData, formattedEquipment);

            // Throttle slightly to prevent browser from blocking multiple popups/downloads
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        } catch (err) {
          console.error(`Failed to fetch/generate PDF for ID ${id}`, err);
        }
      }
    } catch (error) {
      console.error("Batch download error:", error);
      alert("An error occurred while processing downloads.");
    } finally {
      setIsDownloadingPdf(false);
      // Optional: Clear selection after download
      // setSelectedIds([]); 
    }
  };

  const handleExportToExcel = async () => {
    const recordsToExport = selectedIds.length > 0 
      ? inwards.filter(i => selectedIds.includes(i.inward_id))
      : filteredInwards;

    if (recordsToExport.length === 0) {
      alert("No inwards to export.");
      return;
    }

    setIsExporting(true);
    try {
      const inwardIds = recordsToExport.map(inward => inward.inward_id);
      // Using the specific endpoint for inward data export
      const response = await api.post(
        ENDPOINTS.STAFF.INWARD_EXPORT_BATCH_INWARD_ONLY,
        { inward_ids: inwardIds },
        { responseType: "blob" }
      );

      // Create Blob and trigger download
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

  // --- Navigation Handlers ---
  const handleSort = (field: keyof InwardDetail) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleViewInward = (inwardId: number) => navigate(`/engineer/view-inward/${inwardId}`);
  const handleEditInward = (inwardId: number) => navigate(`/engineer/edit-inward/${inwardId}`);
  const handlePrintStickers = (inwardId: number) => navigate(`/engineer/print-stickers/${inwardId}`);

  // --- UI Helpers ---
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "created": return "bg-blue-100 text-blue-800";
      case "updated": return "bg-purple-100 text-purple-800";
      case "in_progress": return "bg-yellow-100 text-yellow-800";
      case "reviewed": return "bg-green-100 text-green-800";
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

  // --- Render ---
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
          <button onClick={fetchInwards} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between border-b pb-4 mb-6 gap-4">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">View & Update Inward</h1>
            <p className="text-gray-600">Manage existing inward records</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchInwards}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh List"
          >
            <RefreshCw size={20} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/engineer')}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
          >
            <ArrowLeft size={20} />
            <span>Back to Portal</span>
          </button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by SRF, Customer or DC No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Status Filter */}
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

          {/* Record Count */}
          <div className="text-right self-center">
            <span className="text-sm text-gray-600">
              Showing {filteredInwards.length} of {inwards.length} records
            </span>
            {selectedIds.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {selectedIds.length} Selected
              </span>
            )}
          </div>
        </div>

        {/* Date Range & Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Excel Export */}
            <button
              onClick={handleExportToExcel}
              disabled={isExporting || (filteredInwards.length === 0 && selectedIds.length === 0)}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              title="Export filtered or selected rows to Excel"
            >
              {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              <span>Excel</span>
            </button>

            {/* PDF Download (Batch) */}
            <button
              onClick={handleDownloadSelectedPDFs}
              disabled={isDownloadingPdf || selectedIds.length === 0}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
              title="Select checkboxes to download multiple PDFs"
            >
              {isDownloadingPdf ? <Loader2 className="animate-spin" size={16} /> : <FileDown size={16} />}
              <span>PDF {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
            </button>

            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {/* Select All Checkbox */}
              <th className="p-4 w-10 text-center">
                 <button 
                  onClick={handleSelectAll}
                  className="text-gray-600 hover:text-blue-600 focus:outline-none"
                 >
                   {filteredInwards.length > 0 && selectedIds.length === filteredInwards.length ? (
                     <CheckSquare size={20} className="text-blue-600" />
                   ) : (
                     <Square size={20} />
                   )}
                 </button>
              </th>

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
              <th 
                className="p-4 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("customer_dc_no")}
              >
                <div className="flex items-center gap-2">
                  DC Number
                  <SortIcon field="customer_dc_no" />
                </div>
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">
                Qty
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
                <td colSpan={8} className="p-8 text-center text-gray-500">
                  {searchTerm || statusFilter !== "all" ? "No records match your filters" : "No inward records found"}
                </td>
              </tr>
            ) : (
              filteredInwards.map((inward) => {
                const isSelected = selectedIds.includes(inward.inward_id);
                return (
                  <tr key={inward.inward_id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    {/* Row Checkbox */}
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleSelectRow(inward.inward_id)}
                        className="focus:outline-none"
                      >
                        {isSelected ? (
                          <CheckSquare size={20} className="text-blue-600" />
                        ) : (
                          <Square size={20} className="text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </td>

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
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800 font-medium">
                          {(inward as any).customer_dc_no || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${inward.status?.toLowerCase() === 'reviewed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
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
                          title="Edit / Update Inward"
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Statistics */}
      {inwards.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{inwards.length}</div>
            <div className="text-sm text-gray-600">Total Inwards</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {inwards.filter(i => i.status === 'created').length}
            </div>
            <div className="text-sm text-gray-600">Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {inwards.filter(i => i.status === 'reviewed').length}
            </div>
            <div className="text-sm text-gray-600">Reviewed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {inwards.filter(i => i.status === 'updated').length}
            </div>
            <div className="text-sm text-gray-600">Updated</div>
          </div>
        </div>
      )}
    </div>
  );
};