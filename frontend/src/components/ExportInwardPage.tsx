import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, ENDPOINTS } from "../api/config";

interface ExportInwardItem {
  inward_id: number;
  srf_no: string;
  customer_details?: string;
  status: string;
  received_by?: string;
  updated_at?: string | null;
  equipment_count: number;
  calibration_frequency?: string | null;
  statement_of_conformity?: boolean | null;
  ref_iso_is_doc?: boolean | null;
  ref_manufacturer_manual?: boolean | null;
  ref_customer_requirement?: boolean | null;
  turnaround_time?: number | null;
  remarks?: string | null;
}

const formatDateForInput = (value: Date) => value.toISOString().split("T")[0];

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }
  return parsedDate.toLocaleString();
};

export const ExportInwardPage: React.FC = () => {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    return formatDateForInput(defaultStart);
  });
  const [endDate, setEndDate] = useState(() => formatDateForInput(new Date()));
  const [exportInwards, setExportInwards] = useState<ExportInwardItem[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [selectedInwards, setSelectedInwards] = useState<Set<number>>(new Set());
  const [batchExporting, setBatchExporting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const selectedCount = selectedInwards.size;
  const allSelected =
    exportInwards.length > 0 && exportInwards.every((item) => selectedInwards.has(item.inward_id));

  const boolToText = useCallback((value?: boolean | null) => {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "—";
  }, []);

  const formatTurnaround = useCallback((value?: number | null) => {
    if (value === null || value === undefined) return "—";
    return `${value} day${value === 1 ? "" : "s"}`;
  }, []);

  const getDecisionRuleLabels = useCallback((item: ExportInwardItem): string[] => {
    const labels: string[] = [];
    if (item.ref_iso_is_doc) labels.push("ISO/IS Doc");
    if (item.ref_manufacturer_manual) labels.push("Manufacturer Manual");
    if (item.ref_customer_requirement) labels.push("Customer Requirement");
    return labels;
  }, []);

  const fetchExportInwards = useCallback(async () => {
    setExportLoading(true);
    setExportError(null);
    try {
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        throw new Error("Start date cannot be after end date.");
      }

      const params: Record<string, string> = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      // --- MODIFICATION: Call the new, more flexible endpoint ---
      const response = await api.get<ExportInwardItem[]>(ENDPOINTS.STAFF.INWARDS_EXPORTABLE, {
        params,
      });
      setExportInwards(response.data);
    } catch (error) {
      console.error("Error fetching inwards for export:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      setExportError(`Failed to load inward records: ${message}`);
    } finally {
      setExportLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchExportInwards();
  }, [fetchExportInwards]);

  useEffect(() => {
    setSelectedInwards((previous) => {
      if (previous.size === 0) {
        return previous;
      }
      const validIds = new Set(exportInwards.map((item) => item.inward_id));
      const filtered = new Set<number>();
      previous.forEach((id) => {
        if (validIds.has(id)) {
          filtered.add(id);
        }
      });
      return filtered.size === previous.size ? previous : filtered;
    });
  }, [exportInwards]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

  const resetDateFilters = useCallback(() => {
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);
    setStartDate(formatDateForInput(defaultStart));
    setEndDate(formatDateForInput(new Date()));
  }, []);

  const handleToggleSelection = useCallback((inwardId: number) => {
    setSelectedInwards((previous) => {
      const next = new Set(previous);
      if (next.has(inwardId)) {
        next.delete(inwardId);
      } else {
        next.add(inwardId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedInwards((previous) => {
      if (exportInwards.length === 0) {
        return new Set<number>();
      }
      const allIds = exportInwards.map((item) => item.inward_id);
      const hasAll = allIds.every((id) => previous.has(id));
      const next = new Set(previous);
      if (hasAll) {
        allIds.forEach((id) => next.delete(id));
      } else {
        allIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [exportInwards]);

  const handleExport = useCallback(async (inwardId: number, srfNo: string) => {
    try {
      setExportError(null);
      setExportingId(inwardId);
      const response = await api.get(ENDPOINTS.STAFF.INWARD_EXPORT(inwardId), {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type:
          response.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeSrf = srfNo ? srfNo.replace(/[^a-zA-Z0-9-_]/g, "_") : `${inwardId}`;
      link.href = url;
      link.download = `inward_${safeSrf}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export inward:", error);
      setExportError("Failed to export the inward record. Please try again.");
    } finally {
      setExportingId(null);
    }
  }, []);

  const handleBatchExport = useCallback(async () => {
    if (batchExporting) {
      return;
    }
    const inwardIds = Array.from(selectedInwards);
    if (inwardIds.length === 0) {
      return;
    }

    try {
      setExportError(null);
      setBatchExporting(true);
      const response = await api.post(
        ENDPOINTS.STAFF.INWARD_EXPORT_BATCH,
        { inward_ids: inwardIds },
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
      link.download = `inwards_export_${timestamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSelectedInwards(new Set());
    } catch (error) {
      console.error("Failed to export selected inwards:", error);
      setExportError("Failed to export the selected inward records. Please try again.");
    } finally {
      setBatchExporting(false);
    }
  }, [batchExporting, selectedInwards]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
      <div className="flex flex-wrap items-center justify-between border-b pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
            <Download className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Export Inward Records</h1>
            <p className="mt-1 text-gray-600 text-sm">
              Filter and export finalized inward records to Excel.
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

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label htmlFor="export-start-date" className="text-sm font-medium text-gray-700">
              From
            </label>
            <input
              id="export-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              max={endDate || undefined}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="export-end-date" className="text-sm font-medium text-gray-700">
              To
            </label>
            <input
              id="export-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              min={startDate || undefined}
              max={formatDateForInput(new Date())}
            />
          </div>
          <button
            type="button"
            onClick={resetDateFilters}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100"
          >
            Reset Dates
          </button>
        </div>
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <span className="text-sm text-gray-600">{selectedCount} selected</span>
          )}
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

      {exportError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {exportError}
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
                  checked={exportInwards.length > 0 && allSelected}
                  onChange={handleSelectAll}
                  disabled={exportLoading || batchExporting || exportInwards.length === 0}
                  aria-label="Select all updated inwards"
                />
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                SRF No.
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Customer
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Updated At
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Received By
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Equipments
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Special Instructions
              </th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {exportLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                  Loading inward records...
                </td>
              </tr>
            )}
            {!exportLoading && exportInwards.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-gray-500">
                  No finalized inward records found for the selected date range.
                </td>
              </tr>
            )}
            {!exportLoading &&
              exportInwards.map((item) => (
                <tr
                  key={item.inward_id}
                  className={`hover:bg-gray-50 ${selectedInwards.has(item.inward_id) ? "bg-blue-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedInwards.has(item.inward_id)}
                      onChange={() => handleToggleSelection(item.inward_id)}
                      disabled={exportLoading || batchExporting}
                      aria-label={`Select inward ${item.srf_no || item.inward_id}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.srf_no}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.customer_details || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(item.updated_at)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.received_by || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.equipment_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="space-y-1">
                      <div>
                        <span className="font-medium text-gray-700">Frequency:</span>{" "}
                        {item.calibration_frequency && item.calibration_frequency.trim()
                          ? item.calibration_frequency
                          : "—"}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">SoC Required:</span>{" "}
                        {boolToText(item.statement_of_conformity)}
                      </div>
                      {item.statement_of_conformity && (
                        <div>
                          <span className="font-medium text-gray-700">Decision Rule:</span>{" "}
                          {(() => {
                            const rules = getDecisionRuleLabels(item);
                            return rules.length > 0 ? rules.join(", ") : "—";
                          })()}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">TAT:</span>{" "}
                        {formatTurnaround(item.turnaround_time)}
                      </div>
                      {item.remarks && item.remarks.trim() && (
                        <div>
                          <span className="font-medium text-gray-700">Notes:</span>{" "}
                          {item.remarks}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => handleExport(item.inward_id, item.srf_no)}
                      disabled={exportingId === item.inward_id || batchExporting}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                    >
                      {exportingId === item.inward_id ? (
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

export default ExportInwardPage;