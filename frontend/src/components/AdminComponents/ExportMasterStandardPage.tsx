import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, ArrowLeft } from "lucide-react";
import { api, ENDPOINTS } from "../../api/config.ts";

interface ExportMasterStandardItem {
  id: number;
  nomenclature: string;
  range_min?: number | string;
  range_max?: number | string;
  range_unit?: string;
  manufacturer?: string;
  model_serial_no?: string;
  certificate_no?: string;
  calibration_valid_upto?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "—";
  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }
  return parsedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface ExportMasterStandardPageProps {
  onBack: () => void;
}

export const ExportMasterStandardPage: React.FC<ExportMasterStandardPageProps> = ({ onBack }) => {
  const [standards, setStandards] = useState<ExportMasterStandardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [selectedStandards, setSelectedStandards] = useState<Set<number>>(new Set());
  const [batchExporting, setBatchExporting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const selectedCount = selectedStandards.size;
  const allSelected =
    standards.length > 0 && standards.every((item) => selectedStandards.has(item.id));

  const fetchStandards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<ExportMasterStandardItem[]>(ENDPOINTS.HTW_MASTER_STANDARDS.LIST);
      setStandards(response.data || []);
    } catch (error) {
      console.error("Error fetching master standards for export:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setError(`Failed to load master standard records: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandards();
  }, [fetchStandards]);

  useEffect(() => {
    setSelectedStandards((previous) => {
      if (previous.size === 0) {
        return previous;
      }
      const validIds = new Set(standards.map((item) => item.id));
      const filtered = new Set<number>();
      previous.forEach((id) => {
        if (validIds.has(id)) {
          filtered.add(id);
        }
      });
      return filtered.size === previous.size ? previous : filtered;
    });
  }, [standards]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

  const handleToggleSelection = useCallback((standardId: number) => {
    setSelectedStandards((previous) => {
      const next = new Set(previous);
      if (next.has(standardId)) {
        next.delete(standardId);
      } else {
        next.add(standardId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedStandards((previous) => {
      if (standards.length === 0) {
        return new Set<number>();
      }
      const allIds = standards.map((item) => item.id);
      const hasAll = allIds.every((id) => previous.has(id));
      const next = new Set(previous);
      if (hasAll) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [standards]);

  const handleExport = useCallback(async (standardId: number) => {
    try {
      setError(null);
      setExportingId(standardId);
      // Use POST batch endpoint for individual export to ensure consistency
      const response = await api.post(
        ENDPOINTS.HTW_MASTER_STANDARDS.EXPORT_BATCH,
        { standard_ids: [standardId] },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], {
        type:
          response.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `master_standard_${standardId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Failed to export master standard:", error);
      setError("Failed to export the master standard record. Please try again.");
    } finally {
      setExportingId(null);
    }
  }, []);

  const handleBatchExport = useCallback(async () => {
    if (batchExporting) {
      return;
    }
    const standardIds = Array.from(selectedStandards);
    if (standardIds.length === 0) {
      return;
    }

    try {
      setError(null);
      setBatchExporting(true);
      
      // Use POST endpoint for batch export if available, otherwise use GET with query params
      const response = await api.post(
        ENDPOINTS.HTW_MASTER_STANDARDS.EXPORT_BATCH,
        { standard_ids: standardIds },
        { responseType: "blob" }
      );

      const blob = new Blob([response.data], {
        type:
          response.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = url;
      link.download = `master_standards_export_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSelectedStandards(new Set());
    } catch (error) {
      console.error("Failed to export selected master standards:", error);
      setError("Failed to export the selected master standard records. Please try again.");
    } finally {
      setBatchExporting(false);
    }
  }, [batchExporting, selectedStandards]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      <div className="flex flex-wrap items-center justify-between border-b pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
            <Download className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Export Master Standard Records</h1>
            <p className="mt-1 text-gray-600 text-sm">
              Select and export master standard records to Excel.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <span className="text-sm text-gray-600">{selectedCount} selected</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBatchExport}
            disabled={selectedCount === 0 || batchExporting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {batchExporting ? (
              "Exporting..."
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={standards.length > 0 && allSelected}
                  onChange={handleSelectAll}
                  disabled={loading || batchExporting || standards.length === 0}
                  aria-label="Select all master standards"
                />
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Nomenclature
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Manufacturer / Model
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Range
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Certificate No
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Valid Upto
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading master standard records...
                </td>
              </tr>
            )}
            {!loading && standards.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                  No master standard records found.
                </td>
              </tr>
            )}
            {!loading &&
              standards.map((item) => (
                <tr
                  key={item.id}
                  className={`hover:bg-gray-50 ${selectedStandards.has(item.id) ? "bg-blue-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedStandards.has(item.id)}
                      onChange={() => handleToggleSelection(item.id)}
                      disabled={loading || batchExporting}
                      aria-label={`Select master standard ${item.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.nomenclature}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="font-medium">{item.manufacturer || "—"}</div>
                    <div className="text-xs text-gray-400">{item.model_serial_no || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.range_min || "—"} - {item.range_max || "—"} {item.range_unit || ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{item.certificate_no || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(item.calibration_valid_upto)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => handleExport(item.id)}
                      disabled={exportingId === item.id || batchExporting}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                    >
                      {exportingId === item.id ? (
                        "Exporting..."
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Export
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExportMasterStandardPage;

