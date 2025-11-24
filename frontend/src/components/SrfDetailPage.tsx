import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { AxiosResponse } from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import axios from "axios";
import { 
  BookOpen, 
  XCircle, 
  ArrowLeft, 
  Download, 
  Wrench, 
  UserCircle, 
  Lightbulb,
  Save,
  CheckCircle2,
  Clock,
  FileText
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = "http://localhost:8000/api/";

// --- Interfaces ---
interface SrfEquipmentDetail {
  srf_eqp_id?: number;
  unit?: string;
  no_of_calibration_points?: string;
  mode_of_calibration?: string;
}

interface EquipmentDetail {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  quantity: number;
  range?: string;
  srf_equipment?: SrfEquipmentDetail | null;
}

interface CustomerData {
  customer_id: number;
  customer_details: string; // Company Name
  phone?: string;
  contact_person?: string;
  email?: string;
  bill_to_address?: string;
  ship_to_address?: string;
}

interface InwardDetail {
  inward_id: number;
  customer_details: string;
  equipments: EquipmentDetail[];
  customer?: CustomerData;
  srf_no?: string; 
  customer_dc_no?: string;
  customer_dc_date?: string;
  material_inward_date?: string;
}

interface SrfDetail {
  srf_id: number;
  inward_id: number;
  srf_no: number;
  nepl_srf_no?: string;
  date: string;
  company_name: string;
  address: string;
  phone: string;
  telephone?: string;
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

// --- HELPER: Generate Formatted SRF Number ---
const generateNeplSrfNo = (srfNoVal: string | number | undefined): string => {
  if (!srfNoVal) return "";
  const valStr = srfNoVal.toString(); 

  let fullSrf = valStr;
  if (!valStr.toUpperCase().startsWith("NEPL")) {
     fullSrf = `NEPL${valStr}`;
  }

  const match = fullSrf.match(/\d+$/); 
  let lastThree = "000";
  if (match && match[0]) {
      lastThree = match[0].slice(-3).padStart(3, "0");
  }

  return `${fullSrf} / SRF - ${lastThree}`;
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

  // --- PDF Generation ---
  const generatePDF = useCallback(() => {
    if (!srfData) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(16);
    doc.text("Service Request Form (SRF)", pageWidth / 2, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text(`SRF No: ${srfData.nepl_srf_no}`, 14, 25);
    doc.text(`Date: ${srfData.date}`, pageWidth - 50, 25);

    const startY = 35;
    doc.text(`Company: ${srfData.company_name}`, 14, startY);
    doc.text(`Contact: ${srfData.contact_person}`, 14, startY + 6);
    doc.text(`DC No: ${srfData.inward?.customer_dc_no || "-"}`, pageWidth - 80, startY);
    doc.text(`DC Date: ${srfData.inward?.customer_dc_date || "-"}`, pageWidth - 80, startY + 6);

    const tableColumn = ["Equipment", "Make/Model", "Serial No", "Range", "Unit", "Cal Points"];
    const tableRows = srfData.inward?.equipments.map((eq) => [
      eq.material_description,
      `${eq.make} / ${eq.model}`,
      eq.serial_no,
      eq.range || "-",
      eq.srf_equipment?.unit || "-",
      eq.srf_equipment?.no_of_calibration_points || "-"
    ]) || [];

    autoTable(doc, {
      startY: startY + 15,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      styles: { fontSize: 8 }
    });

    doc.save(`SRF_${srfData.nepl_srf_no?.replace(/\//g, "_")}.pdf`);
  }, [srfData]);

  // --- Load Logic ---
  const loadSrfData = useCallback(
    async (id: number, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosAuth.get<SrfDetail>(`/srfs/${id}`, { signal } as any);
        const data: SrfDetail = response.data;
        const customer = data.inward?.customer;

        if (data.inward && data.inward.equipments) {
          data.inward.equipments.forEach((eq) => {
            if (!eq.srf_equipment) eq.srf_equipment = {};
            const calPoints = eq.srf_equipment.no_of_calibration_points;
            eq.srf_equipment.no_of_calibration_points = calPoints != null ? String(calPoints) : "";
          });
        }

        const sanitizedData: SrfDetail = {
          ...data,
          date: data.date ? String(data.date).split("T")[0] : getTodayDateString(),
          nepl_srf_no: generateNeplSrfNo(data.srf_no),
          
          company_name: data.company_name || customer?.customer_details || "",
          address: data.address || customer?.ship_to_address || customer?.bill_to_address || "",
          contact_person: data.contact_person || customer?.contact_person || "",
          phone: data.phone || customer?.phone || "",
          email: data.email || customer?.email || "",
          certificate_issue_name: data.certificate_issue_name || customer?.customer_details || "",

          calibration_frequency: data.calibration_frequency ?? "As per Standard",
          statement_of_conformity: data.statement_of_conformity ?? false,
          ref_iso_is_doc: data.ref_iso_is_doc ?? false,
          ref_manufacturer_manual: data.ref_manufacturer_manual ?? false,
          ref_customer_requirement: data.ref_customer_requirement ?? false,
          turnaround_time: data.turnaround_time !== null ? String(data.turnaround_time) : "",
          remarks: data.remarks ?? "",
        };
        
        setSrfData(sanitizedData);
      } catch (err: any) {
        if (err.code !== "ERR_CANCELED") {
          console.error("Failed to load SRF:", err);
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
          const response: AxiosResponse<InwardDetail> = await axiosAuth.get<InwardDetail>(
            `staff/inwards/${inwardIdFromUrl}`,
            { signal: controller.signal } as any
          );
          const inward = response.data;
          const customer = inward.customer;

          inward.equipments?.forEach((eq) => {
            if (!eq.srf_equipment) eq.srf_equipment = {};
            if (eq.srf_equipment.no_of_calibration_points == null) {
              eq.srf_equipment.no_of_calibration_points = "";
            } else {
              eq.srf_equipment.no_of_calibration_points = String(eq.srf_equipment.no_of_calibration_points);
            }
          });

          const initialDate = inward.material_inward_date 
            ? inward.material_inward_date.split("T")[0]
            : getTodayDateString();

          const srfString = inward.srf_no || "";
          const srfNumber = parseInt(srfString.replace(/\D/g, "")) || 0;

          const newSrfInitialData: SrfDetail = {
            srf_id: 0,
            inward_id: inward.inward_id,
            srf_no: srfNumber, 
            nepl_srf_no: generateNeplSrfNo(srfString), 
            date: initialDate,
            
            company_name: customer?.customer_details || "",
            address: customer?.ship_to_address || customer?.bill_to_address || "",
            phone: customer?.phone || "",
            contact_person: customer?.contact_person || "",
            email: customer?.email || "",
            certificate_issue_name: customer?.customer_details || "",
            
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
      if (!isNaN(id)) {
        setActiveSrfId(id);
        loadSrfData(id, controller.signal);
      }
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
          if (value === null || value === undefined || value === "") return undefined;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? undefined : parsed;
        })();

        const normalizedRemarks = srfData.remarks?.trim() ? srfData.remarks.trim() : undefined;

        // Base payload containing fields allowed during Update
        const basePayload = {
          telephone: srfData.phone,
          contact_person: srfData.contact_person,
          email: srfData.email,
          certificate_issue_name: srfData.certificate_issue_name,
          status: newStatus,
          
          calibration_frequency: srfData.calibration_frequency || null,
          statement_of_conformity: srfData.statement_of_conformity ?? false,
          ref_iso_is_doc: srfData.ref_iso_is_doc ?? false,
          ref_manufacturer_manual: srfData.ref_manufacturer_manual ?? false,
          ref_customer_requirement: srfData.ref_customer_requirement ?? false,
          turnaround_time: normalizedTurnaroundTime,
          remarks: normalizedRemarks,
          
          equipments: srfData.inward?.equipments.map((eq) => ({
            inward_eqp_id: eq.inward_eqp_id,
            unit: eq.srf_equipment?.unit,
            no_of_calibration_points: eq.srf_equipment?.no_of_calibration_points,
            mode_of_calibration: eq.srf_equipment?.mode_of_calibration,
          })),
        };

        if (activeSrfId) {
          // --- PUT (UPDATE) ---
          // We do NOT send 'date', 'srf_no', 'inward_id' or 'nepl_srf_no' 
          // because the backend schema rejects 'date' on updates.
          await axiosAuth.put(`/srfs/${activeSrfId}`, basePayload);
          setSrfData((prev) => (prev ? { ...prev, status: newStatus } : prev));
        } else {
          // --- POST (CREATE) ---
          // We MUST send IDs and Date
          const createPayload = {
            ...basePayload,
            srf_no: srfData.srf_no,
            inward_id: srfData.inward_id,
            date: srfData.date, 
            nepl_srf_no: srfData.nepl_srf_no
          };
          const res = await axiosAuth.post(`/srfs`, createPayload);
          const newId = res.data.srf_id;
          setActiveSrfId(newId);
          setSrfData((prev) => (prev ? { ...prev, srf_id: newId, status: newStatus } : prev));
          navigate(`/engineer/srfs/${newId}`, { replace: true });
        }

        if (showAlert) alert("✅ SRF saved successfully!");

        setHasUserEdited(false);
        setAutoSaveStatus("Saved ✔️");
        setTimeout(() => setAutoSaveStatus(""), 2000);
      } catch (err: any) {
        console.error("Save failed:", err);
        setAutoSaveStatus(`Failed ❌`);
        if (showAlert) alert(`❌ Failed to save SRF: ${JSON.stringify(err.response?.data?.detail || err.message)}`);
      } finally {
        setAutoSaving(false);
      }
    },
    [axiosAuth, activeSrfId, srfData, navigate]
  );

  // Auto-save
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isEngineer || !srfData || !hasUserEdited) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      handleSaveSrf(srfData.status || "in_progress", false);
    }, 1200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [srfData, hasUserEdited, isEngineer, handleSaveSrf]);

  const unitOptions = ["Nm", "lbs in", "lbs ft", "Kgf cm", "cNm", "g.cm", "Kgf m", "in lb", "ft lb", "lbf in", "lbf ft"];

  // --- Styles ---
  const readOnlyInputClasses = "block w-full rounded-md bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed sm:text-sm focus:ring-0 focus:border-slate-200";
  const editableInputClasses = "block w-full rounded-md border-slate-300 shadow-sm sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150";

  if (loading) return <div className="flex items-center justify-center h-96 text-slate-500">Loading SRF Details...</div>;
  if (error) return <div className="p-8 text-center text-red-700 bg-red-50 rounded-lg border border-red-200">{error}</div>;
  if (!srfData) return <div className="flex items-center justify-center h-96 text-slate-500">SRF not found.</div>;

  const isLocked = srfData.status === "approved" || srfData.status === "rejected";
  const canEditMainForm = isEngineer && !isLocked;
  
  const isStandardFrequency = (srfData.calibration_frequency ?? "As per Standard") === "As per Standard";

  const statusInfo = ({
    approved: { label: "Approved", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-4 w-4" /> },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> },
    pending: { label: "Pending Approval", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" /> },
    inward_completed: { label: "Pending Approval", color: "bg-blue-100 text-blue-800", icon: <Clock className="h-4 w-4" /> },
    created: { label: "Draft", color: "bg-slate-100 text-slate-800", icon: <FileText className="h-4 w-4" /> },
    in_progress: { label: "In Progress", color: "bg-slate-100 text-slate-800", icon: <FileText className="h-4 w-4" /> },
  } as const)[srfData.status] || { label: srfData.status, color: "bg-slate-100 text-slate-800", icon: <FileText className="h-4 w-4" /> };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center py-8 px-4 font-sans">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-10 relative space-y-8">
        
        {/* Auto Save Indicator */}
        {autoSaveStatus && !isLocked && (
          <div className={`absolute top-6 right-6 text-sm font-medium transition-all duration-300 px-3 py-1 rounded-full shadow-sm border ${
              autoSaveStatus.includes("Saving") ? "bg-blue-50 text-blue-700 border-blue-100"
                : autoSaveStatus.includes("Failed") ? "bg-red-50 text-red-600 border-red-100"
                : "bg-green-50 text-green-700 border-green-100"
            }`}
          >
            {autoSaveStatus}
          </div>
        )}

        {/* Header */}
        <header className="border-b border-slate-200 pb-6">
          <div className="flex justify-between items-start mb-4">
            <button onClick={() => navigate("/engineer/srfs")} className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold transition-colors flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Back to List
            </button>
            <div className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-full ${statusInfo.color}`}>
              {statusInfo.icon}
              {statusInfo.label}
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">SRF Details</h1>
              {/* Display the generated Format */}
              <p className="text-slate-500 mt-1 font-mono text-sm">{srfData.nepl_srf_no}</p>
            </div>
            <button onClick={generatePDF} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm shadow-sm transition-colors">
              <Download size={16} />
              <span>Download PDF</span>
            </button>
          </div>
        </header>

        {/* Rejection Alert */}
        {srfData.status === "rejected" && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-md">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">SRF Rejected</h3>
                <p className="mt-1 text-sm text-red-700">Reason: "{srfData.remarks}"</p>
              </div>
            </div>
          </div>
        )}

        {/* Customer Details */}
        <section className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <UserCircle className="h-6 w-6 text-indigo-500" />
              <h3 className="text-lg font-semibold text-slate-800">Customer Details</h3>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Ref No</label><input readOnly value={srfData.nepl_srf_no || ""} className={readOnlyInputClasses} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Inward Date</label><input type="date" readOnly={!canEditMainForm} value={srfData.date} onChange={(e) => handleSrfChange("date", e.target.value)} className={!canEditMainForm ? readOnlyInputClasses : editableInputClasses} /></div>
            
            <div className="md:col-span-3"><label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label><input readOnly value={srfData.company_name} className={readOnlyInputClasses} /></div>
            
            <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Address <span className="text-xs text-slate-400 font-normal">(Ship-to)</span></label>
                <textarea rows={2} readOnly={!canEditMainForm} value={srfData.address} onChange={(e) => handleSrfChange("address", e.target.value)} className={!canEditMainForm ? readOnlyInputClasses : editableInputClasses} />
            </div>

            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Person</label><input readOnly={!canEditMainForm} value={srfData.contact_person} onChange={(e) => handleSrfChange("contact_person", e.target.value)} className={!canEditMainForm ? readOnlyInputClasses : editableInputClasses} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label><input readOnly={!canEditMainForm} value={srfData.phone} onChange={(e) => handleSrfChange("phone", e.target.value)} className={!canEditMainForm ? readOnlyInputClasses : editableInputClasses} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label><input type="email" readOnly={!canEditMainForm} value={srfData.email} onChange={(e) => handleSrfChange("email", e.target.value)} className={!canEditMainForm ? readOnlyInputClasses : editableInputClasses} /></div>
            
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">DC No</label><input readOnly value={srfData.inward?.customer_dc_no || "-"} className={readOnlyInputClasses} /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Customer DC Date</label><input readOnly value={srfData.inward?.customer_dc_date || "-"} className={readOnlyInputClasses} /></div>

            <div className="md:col-span-3 mt-2">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-md mb-4">
                    <div className="flex">
                        <Lightbulb className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        <div className="ml-3 text-sm text-blue-700">
                            <span className="font-bold block text-blue-800 mb-1">Certificate Name</span>
                            Default is <strong className="font-semibold">"{srfData.company_name}"</strong>. Edit below if different.
                        </div>
                    </div>
                </div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Certificate Issue Name</label>
                <input type="text" readOnly={!canEditMainForm} value={srfData.certificate_issue_name} onChange={(e) => handleSrfChange("certificate_issue_name", e.target.value)} className={!canEditMainForm ? readOnlyInputClasses : editableInputClasses} />
            </div>
          </div>
        </section>

        {/* Special Instructions - READ ONLY FOR ENGINEER */}
        <section className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2.5">
                    <BookOpen className="h-6 w-6 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Special Instructions (Customer Edit Only)</h3>
                </div>
            </div>
            <div className="p-6 space-y-8">
              
              {/* 1. Frequency */}
              <div>
                <strong className="text-slate-900 text-base font-semibold">1. Calibration Frequency</strong>
                <div className="flex flex-col gap-3 mt-3 text-slate-600">
                    <label className="flex items-center gap-3 w-fit opacity-75">
                        <input type="radio" checked={isStandardFrequency} disabled={true} className="h-4 w-4 text-slate-500 bg-slate-200 border-slate-300" /> 
                        As per Standard
                    </label>
                    <label className="flex items-center gap-3 w-fit opacity-75">
                        <input type="radio" checked={!isStandardFrequency} disabled={true} className="h-4 w-4 text-slate-500 bg-slate-200 border-slate-300" /> 
                        Specify
                    </label>
                    {!isStandardFrequency && (
                        <input type="text" className={`mt-1 w-full max-w-sm ${readOnlyInputClasses}`} value={srfData.calibration_frequency || ""} readOnly={true} />
                    )}
                </div>
              </div>

              {/* 2. Conformity */}
              <div>
                <strong className="text-slate-900 text-base font-semibold">2. Statement of conformity required?</strong>
                <div className="flex gap-6 mt-3 text-slate-600">
                    <label className="flex items-center gap-2 opacity-75">
                        <input type="radio" checked={srfData.statement_of_conformity === true} disabled={true} className="h-4 w-4 text-slate-500 bg-slate-200 border-slate-300" /> YES
                    </label>
                    <label className="flex items-center gap-2 opacity-75">
                        <input type="radio" checked={srfData.statement_of_conformity === false} disabled={true} className="h-4 w-4 text-slate-500 bg-slate-200 border-slate-300" /> NO
                    </label>
                </div>
                {srfData.statement_of_conformity && (
                    <div className="mt-4 pl-6 border-l-2 border-slate-200 text-slate-600">
                        <strong className="text-slate-800 text-sm font-semibold">2.1 Decision Rule</strong>
                        <div className="flex flex-col gap-2 mt-2">
                             {[
                               { label: "Ref. ISO/IS Doc. Standard", checked: srfData.ref_iso_is_doc },
                               { label: "Ref. Manufacturer Manual", checked: srfData.ref_manufacturer_manual },
                               { label: "Ref. Customer Requirement", checked: srfData.ref_customer_requirement }
                             ].map((item, idx) => (
                               <label key={idx} className="flex items-center gap-3 opacity-75">
                                 <input type="checkbox" checked={item.checked ?? false} disabled={true} className="h-4 w-4 rounded text-slate-500 bg-slate-200 border-slate-300" />
                                 {item.label}
                               </label>
                             ))}
                        </div>
                    </div>
                )}
              </div>

              {/* 3. Turnaround */}
              <div>
                <strong className="text-slate-900 text-base font-semibold">3. Turnaround time</strong>
                <input className={`mt-2 w-full max-w-sm ${readOnlyInputClasses}`} value={srfData.turnaround_time || ""} readOnly={true} placeholder="Default" />
              </div>

              {/* 4. Notes */}
              <div>
                <strong className="text-slate-900 text-base font-semibold">4. Additional Notes</strong>
                <textarea rows={3} className={`mt-2 w-full ${readOnlyInputClasses}`} value={srfData.remarks || ""} readOnly={true} placeholder="No additional notes." />
              </div>
            </div>
        </section>

        {/* Equipment Table */}
        <section className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2.5">
              <Wrench className="h-6 w-6 text-indigo-500" />
              <h3 className="text-lg font-semibold text-slate-800">Equipment Details</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-500 uppercase bg-slate-100 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Instrument</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Serial No</th>
                  <th className="px-4 py-3">Range</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Callibration Points</th>
                  <th className="px-4 py-3">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {srfData.inward?.equipments.map((eq) => (
                  <tr key={eq.inward_eqp_id} className="bg-white hover:bg-slate-50 transition">
                    <td className="px-4 py-3 font-medium text-slate-800">{eq.material_description}</td>
                    <td className="px-4 py-3">{eq.model}</td>
                    <td className="px-4 py-3">{eq.serial_no}</td>
                    <td className="px-4 py-3">{eq.range}</td>
                    <td className="px-2 py-2"><select className={canEditMainForm ? editableInputClasses : readOnlyInputClasses} value={eq.srf_equipment?.unit || ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "unit", e.target.value)} disabled={!canEditMainForm}><option value="">Select</option>{unitOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}</select></td>
                    <td className="px-2 py-2"><input type="text" className={canEditMainForm ? editableInputClasses : readOnlyInputClasses} readOnly={!canEditMainForm} value={eq.srf_equipment?.no_of_calibration_points ?? ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "no_of_calibration_points", e.target.value)} /></td>
                    <td className="px-2 py-2"><input type="text" className={canEditMainForm ? editableInputClasses : readOnlyInputClasses} readOnly={!canEditMainForm} value={eq.srf_equipment?.mode_of_calibration || ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "mode_of_calibration", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Actions */}
        {canEditMainForm && (
          <footer className="flex justify-end items-center gap-4 pt-6 mt-8 border-t border-slate-200">
            <button className="px-6 py-2.5 rounded-lg font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition" onClick={() => navigate("/engineer/srfs")}>Cancel</button>
            <button className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed" onClick={() => handleSaveSrf("inward_completed", true)} disabled={autoSaving}>
              <Save className="h-4 w-4" />
              {activeSrfId ? "Save & Send to Customer" : "Create & Send to Customer"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
};

export default SrfDetailPage;