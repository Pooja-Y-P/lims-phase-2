import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { AxiosResponse } from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import axios from "axios";
import { BookOpen, AlertTriangle, XCircle, ArrowLeft } from "lucide-react"; 

const API_BASE = "http://localhost:8000/api/";

// --- Interfaces (No changes needed) ---
interface SrfEquipmentDetail {
  srf_eqp_id?: number;
  unit?: string;
  no_of_calibration_points?: number;
  mode_of_calibration?: string;
}

interface EquipmentDetail {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model:string;
  serial_no: string;
  quantity: number;
  range?: string;
  srf_equipment?: SrfEquipmentDetail | null;
}

interface CustomerData {
  customer_id: number;
  customer_details: string;
  phone?: string;
  contact_person?: string;
  email?: string;
}

interface InwardDetail {
  inward_id: number;
  customer_details: string; 
  equipments: EquipmentDetail[];
  customer?: CustomerData; 
  srf_no?: number;
}

interface SrfDetail {
  srf_id: number;
  inward_id: number;
  srf_no: number;
  nepl_srf_no?: string;
  date: string;
  company_name: string;
  phone: string;
  contact_person: string;
  email: string;
  certificate_issue_name: string;
  status: string;
  inward?: InwardDetail;
  calibration_frequency?: string | null;
  statement_of_conformity?: boolean | null;
  ref_iso_is_doc?: boolean | null;
  ref_manufacturer_manual?: boolean | null;
  ref_customer_requirement?: boolean | null;
  turnaround_time?: string | null;
  remarks?: string | null;
}

const generateNeplSrfNo = (srfNo: number | undefined): string => {
  if (!srfNo) return "";
  const full = srfNo.toString();
  const lastThree = full.slice(-3).padStart(3, "0");
  return `NEPL - ${full} / SRF-${lastThree}`;
};

const getTodayDateString = (): string => new Date().toISOString().split("T")[0];

export const SrfDetailPage: React.FC = () => {
  const { srfId: paramSrfId } = useParams<{ srfId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeSrfId, setActiveSrfId] = useState<number | null>(null);
  const [srfData, setSrfData] = useState<SrfDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>("");
  const [hasUserEdited, setHasUserEdited] = useState(false);

  const isEngineer = user?.role === "engineer";
  
  const isNewSrfFromUrl = paramSrfId?.startsWith("new-");
  const inwardIdFromUrl = isNewSrfFromUrl ? parseInt(paramSrfId!.split("new-")[1]) : undefined;
  
  const token = localStorage.getItem("token");
  const axiosAuth = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      }),
    [token]
  );

  const loadSrfData = useCallback(
    async (id: number, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosAuth.get<SrfDetail>(`/srfs/${id}`, { signal } as any);
        const data: SrfDetail = response.data;
        // MODIFICATION: Default calibration points to 1 if not set
        data.inward?.equipments?.forEach(eq => {
            if (!eq.srf_equipment) {
                eq.srf_equipment = {};
            }
            if (eq.srf_equipment.no_of_calibration_points == null) { // Catches null and undefined
                eq.srf_equipment.no_of_calibration_points = 1;
            }
        });
        const sanitizedData: SrfDetail = {
          ...data,
          date: data.date ? data.date.split("T")[0] : "",
          nepl_srf_no: generateNeplSrfNo(data.srf_no),
          calibration_frequency: data.calibration_frequency ?? "As per Standard",
          statement_of_conformity: data.statement_of_conformity ?? false,
          ref_iso_is_doc: data.ref_iso_is_doc ?? false,
          ref_manufacturer_manual: data.ref_manufacturer_manual ?? false,
          ref_customer_requirement: data.ref_customer_requirement ?? false,
          turnaround_time:
            data.turnaround_time !== null && data.turnaround_time !== undefined
              ? String(data.turnaround_time)
              : "",
          remarks: data.remarks ?? "",
          company_name: data.inward?.customer?.customer_details || "",
          phone: data.inward?.customer?.phone || "",
          contact_person: data.inward?.customer?.contact_person || "",
          email: data.inward?.customer?.email || "",
          certificate_issue_name:
            data.certificate_issue_name ||
            data.inward?.customer?.customer_details ||
            "",
        };
        setSrfData(sanitizedData);
      } catch (err: any) {
        if (err.code !== "ERR_CANCELED") {
          setError(err.response?.data?.detail || "An unknown error occurred.");
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [axiosAuth]
  );

  useEffect(() => {
    const controller = new AbortController();

    if (isNewSrfFromUrl && inwardIdFromUrl) {
      setActiveSrfId(null);
      setLoading(true);
      const fetchInwardData = async () => {
        try {
          const response: AxiosResponse<InwardDetail> = await axiosAuth.get<InwardDetail>(`staff/inwards/${inwardIdFromUrl}`, { signal: controller.signal } as any);
          const inward = response.data;
          // MODIFICATION: Default calibration points to 1 for new SRFs
          inward.equipments?.forEach(eq => {
            if (!eq.srf_equipment) {
                eq.srf_equipment = {};
            }
            if (eq.srf_equipment.no_of_calibration_points == null) {
                eq.srf_equipment.no_of_calibration_points = 1;
            }
          });
          const newSrfInitialData: SrfDetail = {
            srf_id: 0, 
            inward_id: inward.inward_id, 
            srf_no: inward.srf_no || 0,
            nepl_srf_no: generateNeplSrfNo(inward.srf_no || 0), 
            date: getTodayDateString(),
            company_name: inward.customer?.customer_details || "",
            phone: inward.customer?.phone || "",
            contact_person: inward.customer?.contact_person || "",
            email: inward.customer?.email || "",
            certificate_issue_name: inward.customer?.customer_details || inward.customer_details || "",
            status: "created", 
            inward: inward,
            calibration_frequency: "As per Standard",
            statement_of_conformity: false,
            ref_iso_is_doc: false,
            ref_manufacturer_manual: false,
            ref_customer_requirement: false,
            turnaround_time: "",
            remarks: "",
          };
          setSrfData(newSrfInitialData);
        } catch (err: any) {
          if (err.code !== "ERR_CANCELED") {
            setError(`Failed to load Inward data for ID ${inwardIdFromUrl}.`);
          }
        } finally {
          setLoading(false);
        }
      };
      fetchInwardData();
    } else if (!isNewSrfFromUrl && paramSrfId) {
      const id = parseInt(paramSrfId);
      setActiveSrfId(id);
      loadSrfData(id, controller.signal);
    } else {
      setLoading(false);
    }

    return () => controller.abort();
  }, [paramSrfId, isNewSrfFromUrl, inwardIdFromUrl, loadSrfData, axiosAuth]);

  const handleSrfChange = (key: keyof SrfDetail, value: any) => {
    setHasUserEdited(true);
    setSrfData((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleSrfEquipmentChange = (inward_eqp_id: number, field: keyof SrfEquipmentDetail, value: any) => {
    setHasUserEdited(true);
    setSrfData((prevData) => {
      if (!prevData || !prevData.inward) return prevData;
      const updatedEquipments = prevData.inward.equipments.map((eq) => {
        if (eq.inward_eqp_id === inward_eqp_id) {
          const newSrfEquipment = { ...(eq.srf_equipment || {}), [field]: value };
          return { ...eq, srf_equipment: newSrfEquipment };
        }
        return eq;
      });
      return { ...prevData, inward: { ...prevData.inward, equipments: updatedEquipments } };
    });
  };

  const handleSaveSrf = useCallback(
    async (newStatus: string, showAlert: boolean = false) => {
      if (!srfData) return;
      setAutoSaving(true);
      setAutoSaveStatus("Saving...");
      setError(null);

      try {
        const normalizedTurnaroundTime = (() => {
          const value = srfData.turnaround_time;
          if (value === null || value === undefined) return undefined;
          if (typeof value === "number") return value;
          const trimmed = value.trim();
          if (!trimmed) return undefined;
          const parsed = Number(trimmed);
          return Number.isNaN(parsed) ? undefined : parsed;
        })();

        const payload = {
          srf_no: srfData.srf_no,
          date: srfData.date,
          nepl_srf_no: srfData.nepl_srf_no,
          telephone: srfData.phone,
          contact_person: srfData.contact_person,
          email: srfData.email,
          certificate_issue_name: srfData.certificate_issue_name,
          status: newStatus,
          inward_id: srfData.inward_id,
          calibration_frequency: srfData.calibration_frequency || null,
          statement_of_conformity: srfData.statement_of_conformity ?? false,
          ref_iso_is_doc: srfData.ref_iso_is_doc ?? false,
          ref_manufacturer_manual: srfData.ref_manufacturer_manual ?? false,
          ref_customer_requirement: srfData.ref_customer_requirement ?? false,
          turnaround_time: normalizedTurnaroundTime,
          remarks: srfData.remarks?.trim() ? srfData.remarks.trim() : undefined,
          equipments: srfData.inward?.equipments.map((eq) => ({
            srf_eqp_id: eq.srf_equipment?.srf_eqp_id,
            inward_eqp_id: eq.inward_eqp_id,
            unit: eq.srf_equipment?.unit,
            no_of_calibration_points: eq.srf_equipment?.no_of_calibration_points,
            mode_of_calibration: eq.srf_equipment?.mode_of_calibration,
          })),
        };

        if (activeSrfId) {
          await axiosAuth.put(`/srfs/${activeSrfId}`, payload);
          setSrfData((prev) => (prev ? { ...prev, status: newStatus } : prev));
        } else {
          const res = await axiosAuth.post(`/srfs`, payload);
          const newId = res.data.srf_id;
          setActiveSrfId(newId);
          setSrfData((prev) => (prev ? { ...prev, srf_id: newId, status: newStatus } : prev));
          navigate(`/engineer/srfs/${newId}`, { replace: true });
        }

        if (showAlert) {
          alert("✅ SRF saved and marked as completed successfully!");
        }

        setHasUserEdited(false);
        setAutoSaveStatus("All changes saved successfully ✔️");
        setTimeout(() => setAutoSaveStatus(""), 2000);
      } catch (err: any) {
        const errorDetail = err.response?.data?.detail || "An unexpected error occurred.";
        console.error("Save failed:", err);
        setAutoSaveStatus(`Failed to save ❌ (${errorDetail})`);
        if (showAlert) {
          alert(`❌ Failed to save SRF: ${errorDetail}`);
        }
      } finally {
        setAutoSaving(false);
      }
    },
    [axiosAuth, activeSrfId, srfData, navigate]
  );

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isEngineer || !srfData || !hasUserEdited) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSaveSrf(srfData.status || "in_progress", false);
    }, 1200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [srfData, hasUserEdited, isEngineer, handleSaveSrf]);

  const unitOptions = ["Nm", "lbs in", "lbs ft", "Kgf cm", "cNm", "g.cm", "Kgf m", "in lb", "ft lb", "lbf in", "lbf ft"];

  if (loading) return <div className="p-12 text-center text-gray-500">Loading SRF Details...</div>;
  if (error) return <div className="p-12 text-center text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!srfData) return <div className="p-12 text-center text-gray-500">SRF not found.</div>;

  const isLocked = srfData.status === 'approved' || srfData.status === 'rejected';
  const canEditMainForm = isEngineer && !isLocked;
  const isStandardFrequency = (srfData.calibration_frequency ?? "As per Standard") === "As per Standard";
  const decisionRules: Array<{ key: "ref_iso_is_doc" | "ref_manufacturer_manual" | "ref_customer_requirement"; label: string; value: boolean; }> = [
    { key: "ref_iso_is_doc", label: "Ref. ISO/IS Doc. Standard", value: srfData.ref_iso_is_doc ?? false },
    { key: "ref_manufacturer_manual", label: "Ref. Manufacturer Manual", value: srfData.ref_manufacturer_manual ?? false },
    { key: "ref_customer_requirement", label: "Ref. Customer Requirement", value: srfData.ref_customer_requirement ?? false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-8 px-4">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-10 relative">
        {autoSaveStatus && !isLocked && (
          <div className={`absolute top-4 right-6 text-sm font-medium transition-all duration-300 px-3 py-1 rounded-lg shadow-sm ${
              autoSaveStatus.includes("Saving") ? "bg-blue-50 text-blue-700"
                : autoSaveStatus.includes("Failed") ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-700"
            }`}
          >
            {autoSaveStatus}
          </div>
        )}

        {/* --- MODIFICATION START: New Header --- */}
        <header className="flex items-center justify-between border-b pb-4 mb-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">SRF Details</h1>
                <p className="text-lg text-blue-600 font-mono mt-1">{srfData.nepl_srf_no}</p>
            </div>
            <button
                type="button"
                onClick={() => navigate('/engineer/srfs')}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
            >
                <ArrowLeft size={18} />
                <span>Back to SRF List</span>
            </button>
        </header>
        {/* --- MODIFICATION END --- */}

        {isLocked && (
            <div className={`p-4 mb-8 border-l-4 rounded-r-lg ${
                srfData.status === 'rejected' 
                ? 'bg-red-50 text-red-800 border-red-400' 
                : 'bg-yellow-50 text-yellow-800 border-yellow-400'
            }`}>
                <div className="flex items-start gap-3">
                    {srfData.status === 'rejected' ? <XCircle className="h-6 w-6 flex-shrink-0" /> : <AlertTriangle className="h-6 w-6 flex-shrink-0" />}
                    <div>
                        <p className="text-sm">This SRF has been <span className="font-semibold">{srfData.status}</span> by the customer and can no longer be edited.</p>
                        {srfData.status === 'rejected' && srfData.remarks && (
                            <div className="mt-3 pt-3 border-t border-red-200">
                                <p className="font-semibold text-sm">Customer's Rejection Reason:</p>
                                <p className="text-sm italic mt-1">"{srfData.remarks}"</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <fieldset className="border border-gray-300 rounded-2xl p-6 mb-10 bg-gray-50">
          <legend className="px-3 text-lg font-semibold text-gray-800 bg-white rounded-md shadow-sm">Customer Details</legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ref</label>
              <input readOnly value={srfData.nepl_srf_no || ""} className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of SRF</label>
              <input type="date" readOnly={!canEditMainForm} value={srfData.date} onChange={(e) => handleSrfChange("date", e.target.value)} className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${ canEditMainForm ? "bg-white" : "bg-gray-100 cursor-not-allowed"}`} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name & Address</label>
              <textarea rows={3} readOnly value={srfData.company_name} className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input readOnly value={srfData.phone} className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input readOnly value={srfData.contact_person} className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" readOnly value={srfData.email} className="block w-full rounded-lg border-gray-300 bg-gray-100 cursor-not-allowed text-sm px-3 py-2" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Issue Name</label>
              <input type="text" readOnly={!canEditMainForm} value={srfData.certificate_issue_name} onChange={(e) => handleSrfChange("certificate_issue_name", e.target.value)} className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${ canEditMainForm ? "bg-white" : "bg-gray-100 cursor-not-allowed"}`} />
            </div>
          </div>
        </fieldset>

        <fieldset className="mb-10 border border-gray-300 rounded-2xl bg-gray-50 p-6">
            <legend className="flex items-center gap-2 px-3 py-1.5 text-lg font-semibold text-gray-800 bg-white rounded-md shadow-sm">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              Special Instructions 
            </legend>
            <div className="mt-6 space-y-8 text-sm text-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">Calibration Frequency</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3"><input type="radio" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" checked={isStandardFrequency} disabled={true} /> As per Standard</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3"><input type="radio" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" checked={!isStandardFrequency} disabled={true} /> Specify</label>
                    {!isStandardFrequency && (<input type="text" className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" value={srfData.calibration_frequency || ""} readOnly={true} />)}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">Statement of Conformity required?</p>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-3"><input type="radio" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" checked={Boolean(srfData.statement_of_conformity)} disabled={true} /> Yes</label>
                  <label className="flex items-center gap-3"><input type="radio" className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" checked={!srfData.statement_of_conformity} disabled={true} /> No</label>
                </div>
                {srfData.statement_of_conformity && (
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-800 mb-3">Decision Rule</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {decisionRules.map((rule) => (
                        <label key={rule.key} className="flex items-center gap-3">
                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" checked={rule.value} disabled={true} /> {rule.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">Turnaround Time (days)</label>
                  <input type="number" min={0} className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" value={srfData.turnaround_time ?? ""} readOnly={true} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-2">Additional Notes</label>
                  <textarea rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-100 cursor-not-allowed" value={srfData.remarks || ""} readOnly={true} placeholder="No additional notes provided." />
                </div>
              </div>
            </div>
          </fieldset>
        
        <fieldset className="border border-gray-300 rounded-2xl p-6 bg-gray-50">
          <legend className="px-3 text-lg font-semibold text-gray-800 bg-white rounded-md shadow-sm">Equipment Details</legend>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm text-left text-gray-700">
              <thead className="text-xs uppercase bg-gray-100 text-gray-600">
                <tr>
                  <th className="px-4 py-3">Instrument Nomenclature</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Serial No/ID</th>
                  <th className="px-4 py-3">Range</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Calibration Points</th>
                  <th className="px-4 py-3">Mode of Calibration</th>
                </tr>
              </thead>
              <tbody>
                {srfData.inward?.equipments.map((eq) => (
                  <tr key={eq.inward_eqp_id} className="bg-white border-b hover:bg-blue-50 transition">
                    <td className="px-4 py-2">{eq.material_description}</td>
                    <td className="px-4 py-2 font-medium">{eq.model}</td>
                    <td className="px-4 py-2">{eq.serial_no}</td>
                    <td className="px-4 py-2">{eq.range}</td>
                    <td className="px-2 py-1">
                      <select className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${ canEditMainForm ? "cursor-pointer bg-white" : "cursor-not-allowed bg-gray-100" }`} value={eq.srf_equipment?.unit || ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "unit", e.target.value)} disabled={!canEditMainForm}>
                        <option value="">Select Unit</option>
                        {unitOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input 
                        type="number" 
                        min="1"
                        className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${ canEditMainForm ? "bg-white" : "bg-gray-100 cursor-not-allowed" }`} 
                        readOnly={!canEditMainForm} 
                        value={eq.srf_equipment?.no_of_calibration_points ?? ""} 
                        onChange={(e) => {
                            const rawValue = e.target.value;
                            if (rawValue === "") {
                                handleSrfEquipmentChange(eq.inward_eqp_id, "no_of_calibration_points", undefined);
                            } else {
                                const numValue = parseInt(rawValue, 10);
                                if (!isNaN(numValue)) {
                                    handleSrfEquipmentChange(eq.inward_eqp_id, "no_of_calibration_points", numValue);
                                }
                            }
                        }}
                        onBlur={() => {
                            const currentValue = eq.srf_equipment?.no_of_calibration_points;
                            if (currentValue === undefined || isNaN(currentValue) || currentValue < 1) {
                                handleSrfEquipmentChange(eq.inward_eqp_id, "no_of_calibration_points", 1);
                            }
                        }}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input type="text" className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${ canEditMainForm ? "bg-white" : "bg-gray-100 cursor-not-allowed" }`} readOnly={!canEditMainForm} value={eq.srf_equipment?.mode_of_calibration || ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "mode_of_calibration", e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>

        {canEditMainForm && (
          <div className="flex justify-end items-center gap-4 pt-8 mt-8 border-t border-gray-200">
            <button className="px-5 py-2.5 rounded-lg font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 transition" onClick={() => navigate("/engineer/srfs")}>Cancel</button>
            <button className="px-5 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition disabled:opacity-60" onClick={() => handleSaveSrf("inward_completed", true)} disabled={autoSaving}>
              {activeSrfId ? "Save and Complete" : "Create SRF & Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
 
export default SrfDetailPage;