import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { AxiosResponse } from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import axios from "axios";
import { BookOpen, XCircle, ArrowLeft, Download, CheckCircle, Calendar, User, Phone, Mail, FileText, MapPin, Building, Award, Home } from "lucide-react";
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
  customer_details: string;
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
  srf_no: string;
  nepl_srf_no?: string;
  date: string;

  company_name: string;
  customer_name?: string;

  // Address split (Internal UI State)
  bill_to_address: string;
  ship_to_address: string;

  phone: string;
  telephone?: string;

  contact_person: string;
  email: string;

  // Certificate Info
  certificate_issue_name: string;
  certificate_issue_adress: string; // Backend spelling

  status: string;
  inward?: InwardDetail;

  // Special Instructions
  calibration_frequency?: string | null;
  statement_of_conformity?: boolean | null;
  ref_iso_is_doc?: boolean | null;
  ref_manufacturer_manual?: boolean | null;
  ref_customer_requirement?: boolean | null;
  turnaround_time?: string | null;
  remarks?: string | null;
}

// Helper function handles Strings (NEPL25001)
const generateNeplSrfNo = (srfNo: string | number | undefined): string => {
  if (!srfNo) return "";
  const srfStr = srfNo.toString();
  if (srfStr.includes("/ SRF-")) return srfStr;
  const match = srfStr.match(/(\d+)$/);
  const lastDigits = match ? match[0].slice(-3) : "000";
  return `${srfStr} / SRF-${lastDigits}`;
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

  // Ref to track if we just created a form to prevent re-fetching/overwriting
  const justCreatedRef = useRef(false);

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
    doc.text(`SRF No: ${srfData.nepl_srf_no || srfData.srf_no}`, 14, 25);
    doc.text(`Date: ${srfData.date}`, pageWidth - 50, 25);

    const startY = 35;
    doc.text(`Company: ${srfData.company_name}`, 14, startY);
    doc.text(`Contact: ${srfData.contact_person}`, 14, startY + 6);

    const billToLines = doc.splitTextToSize(`Bill To: ${srfData.bill_to_address}`, 80);
    doc.text(billToLines, 14, startY + 12);

    doc.text(`DC No: ${srfData.inward?.customer_dc_no || "-"}`, pageWidth - 80, startY);
    doc.text(`DC Date: ${srfData.inward?.customer_dc_date || "-"}`, pageWidth - 80, startY + 6);

    const tableColumn = ["Equipment", "Make/Model", "Serial No", "Range", "Unit", "Cal Points", "Mode of Calibration"];
    
    // --- FIX: Added fallback '|| "-"' to all optional fields to prevent undefined errors ---
    const tableRows = srfData.inward?.equipments.map((eq) => [
      eq.material_description || "",
      `${eq.make || ""} / ${eq.model || ""}`,
      eq.serial_no || "",
      eq.range || "-", 
      eq.srf_equipment?.unit || "-",
      eq.srf_equipment?.no_of_calibration_points || "-",
      eq.srf_equipment?.mode_of_calibration || "-"
    ]) || [];
    // ---------------------------------------------------------------------------------------

    const tableStartY = startY + 15 + (billToLines.length * 5);

    autoTable(doc, {
      startY: tableStartY,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 8 }
    });

    doc.save(`SRF_${srfData.nepl_srf_no || srfData.srf_no}.pdf`);
  }, [srfData]);

  // --- Load SRF Data ---
  const loadSrfData = useCallback(
    async (id: number, signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosAuth.get<SrfDetail>(`/srfs/${id}`, { signal } as any);
        const data = response.data;
        const rawData = data as any;

        data.inward?.equipments?.forEach((eq) => {
          if (!eq.srf_equipment) eq.srf_equipment = {};
          if (eq.srf_equipment.no_of_calibration_points == null) eq.srf_equipment.no_of_calibration_points = "";
        });

        const companyName = data.customer_name || data.inward?.customer?.customer_details || "";
        const contactPerson = data.contact_person || data.inward?.customer?.contact_person || "";
        const email = data.email || data.inward?.customer?.email || "";
        const phone = data.telephone || data.inward?.customer?.phone || data.phone || "";
        
        const billTo = rawData.address || data.bill_to_address || data.inward?.customer?.bill_to_address || "";
        const shipTo = data.ship_to_address || data.inward?.customer?.ship_to_address || "";

        const displaySrfNo = data.nepl_srf_no || generateNeplSrfNo(data.srf_no);
        const certAddress = rawData.certificate_issue_adress || data.certificate_issue_adress || "";

        const sanitizedData: SrfDetail = {
          ...data,
          date: data.date ? data.date.split("T")[0] : "",
          srf_no: data.srf_no,
          nepl_srf_no: displaySrfNo,
          bill_to_address: billTo,
          ship_to_address: shipTo,
          calibration_frequency: data.calibration_frequency ?? "As per Standard",
          statement_of_conformity: data.statement_of_conformity ?? false,
          ref_iso_is_doc: data.ref_iso_is_doc ?? false,
          ref_manufacturer_manual: data.ref_manufacturer_manual ?? false,
          ref_customer_requirement: data.ref_customer_requirement ?? false,
          turnaround_time: data.turnaround_time !== null ? String(data.turnaround_time) : "",
          remarks: data.remarks ?? "",
          company_name: companyName,
          phone: phone,
          contact_person: contactPerson,
          email: email,
          certificate_issue_name: data.certificate_issue_name || companyName,
          certificate_issue_adress: certAddress,
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

  // --- Initial Load Effect ---
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

          inward.equipments?.forEach((eq) => {
            if (!eq.srf_equipment) eq.srf_equipment = {};
            if (eq.srf_equipment.no_of_calibration_points == null) eq.srf_equipment.no_of_calibration_points = "1";
          });

          const initialDate = inward.material_inward_date
            ? inward.material_inward_date.split("T")[0]
            : getTodayDateString();

          const billTo = inward.customer?.bill_to_address || "";
          const shipTo = inward.customer?.ship_to_address || "";
          const generatedRef = generateNeplSrfNo(inward.srf_no);

          const newSrfInitialData: SrfDetail = {
            srf_id: 0,
            inward_id: inward.inward_id,
            srf_no: inward.srf_no || "",
            nepl_srf_no: generatedRef,
            date: initialDate,
            company_name: inward.customer?.customer_details || inward.customer_details || "",
            bill_to_address: billTo,
            ship_to_address: shipTo,
            phone: inward.customer?.phone || "",
            contact_person: inward.customer?.contact_person || "",
            email: inward.customer?.email || "",
            certificate_issue_name: inward.customer?.customer_details || inward.customer_details || "",
            certificate_issue_adress: "",
            status: "draft", // CHANGED: Initialize as "draft" instead of "created"
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

      if (justCreatedRef.current) {
        justCreatedRef.current = false;
        setLoading(false);
        return;
      }
      loadSrfData(id, controller.signal);
    } else {
      setLoading(false);
    }

    return () => controller.abort();
  }, [paramSrfId, isNewSrfFromUrl, inwardIdFromUrl, loadSrfData, axiosAuth]);

  // --- Handle Changes ---
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

  // --- Save Function ---
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
          address: srfData.bill_to_address,
          ship_to_address: srfData.ship_to_address,
          certificate_issue_name: srfData.certificate_issue_name,
          certificate_issue_adress: srfData.certificate_issue_adress,
          status: newStatus,
          inward_status: "reviewed",
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

        console.log("Saving SRF Payload:", payload);

        if (activeSrfId || (srfData.srf_id && srfData.srf_id > 0)) {
          const targetId = activeSrfId || srfData.srf_id;
          await axiosAuth.put(`/srfs/${targetId}`, payload);
          setSrfData((prev) => (prev ? { ...prev, status: newStatus } : prev));
        } else {
          const res = await axiosAuth.post(`/srfs/`, payload);
          const newId = res.data.srf_id;
          
          // Optionally call PUT immediately to confirm full data persistence if POST is partial
          await axiosAuth.put(`/srfs/${newId}`, payload);
          
          justCreatedRef.current = true;
          setActiveSrfId(newId);
          setSrfData((prev) => (prev ? { ...prev, srf_id: newId, status: newStatus } : prev));
          navigate(`/engineer/srfs/${newId}`, { replace: true });
        }

        if (showAlert) {
          alert("✅ SRF saved successfully!");
          navigate("/engineer/srfs");
        }

        setHasUserEdited(false);
        setAutoSaveStatus("All changes saved successfully ✔️");
        setTimeout(() => setAutoSaveStatus(""), 2000);
      } catch (err: any) {
        const errorDetail = err.response?.data?.detail || "An unexpected error occurred.";
        console.error("Save failed error:", err);
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

  // --- Auto-Save Effect ---
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isEngineer || !srfData || !hasUserEdited) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // CHANGED: If status is 'created' or 'draft', force it to save as 'draft'
      const statusToSave = (srfData.status === "created" || srfData.status === "draft") ? "draft" : srfData.status;
      handleSaveSrf(statusToSave, false);
    }, 1200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [srfData, hasUserEdited, isEngineer, handleSaveSrf]);

  const unitOptions = ["Nm", "lbs in", "lbs ft", "Kgf cm", "cNm", "g.cm", "Kgf m", "in lb", "ft lb", "lbf in", "lbf ft"];

  if (loading) return <div className="p-12 text-center text-gray-500">Loading SRF Details...</div>;
  if (error) return <div className="p-12 text-center text-red-600 bg-red-50 rounded-lg">Error: {error}</div>;
  if (!srfData) return <div className="p-12 text-center text-gray-500">SRF not found.</div>;

  const canEdit = isEngineer;
  const isApproved = srfData.status === "approved";
  const isRejected = srfData.status === "rejected";
  const showSpecialInstructions = isApproved || isRejected;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center py-8 px-4">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-10 relative">
        
        {/* Auto Save Status */}
        <div className={`absolute top-4 right-6 text-sm font-medium transition-all duration-300 px-3 py-1 rounded-lg shadow-sm ${
            autoSaveStatus.includes("Saving") ? "bg-blue-50 text-blue-700"
              : autoSaveStatus.includes("Failed") ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-700"
          } ${!autoSaveStatus && "opacity-0"}`}
        >
          {autoSaveStatus || "Saved"}
        </div>

        {/* Header */}
        <header className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">SRF Details</h1>
            <p className="text-lg text-blue-600 font-mono mt-1">{srfData.nepl_srf_no}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={generatePDF} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm">
                <Download size={18} />
                <span>Download PDF</span>
            </button>
            <button type="button" onClick={() => navigate("/engineer/srfs")} className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm">
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
          </div>
        </header>

        {/* Status Banner */}
        {(isApproved || isRejected) && (
          <div className={`p-4 mb-8 border-l-4 rounded-r-lg ${isRejected ? "bg-red-50 text-red-800 border-red-400" : "bg-green-50 text-green-800 border-green-400"}`}>
            <div className="flex items-start gap-3">
              {isRejected ? <XCircle className="h-6 w-6 flex-shrink-0" /> : <CheckCircle className="h-6 w-6 flex-shrink-0" />}
              <div>
                <p className="text-sm font-semibold">
                  Current Status: {srfData.status.charAt(0).toUpperCase() + srfData.status.slice(1)}
                </p>
                {isRejected && srfData.remarks && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Rejection Reason:</p>
                    <p className="text-sm italic">"{srfData.remarks}"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Customer Details - Improved UI Layout */}
        <fieldset className="border border-gray-300 rounded-2xl p-6 mb-10 bg-white shadow-sm">
          <legend className="px-3 text-lg font-semibold text-gray-800 bg-white rounded-md shadow-sm border border-gray-200">
            Customer Details
          </legend>

          {/* Row 1: Document Info (DC No, Date, Ref, Inward Date) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6 mt-2">
             <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer DC No</label>
                <div className="flex items-center w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                   <FileText size={16} className="mr-2 text-gray-400"/>
                   {srfData.inward?.customer_dc_no || "-"}
                </div>
             </div>
             
             <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer DC Date</label>
                <div className="flex items-center w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                   <Calendar size={16} className="mr-2 text-gray-400"/>
                   {srfData.inward?.customer_dc_date || "-"}
                </div>
             </div>

             <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reference (SRF No)</label>
                <div className="flex items-center w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                   <span className="font-mono text-blue-600">{srfData.nepl_srf_no}</span>
                </div>
             </div>

             <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Material Inward Date</label>
                <input
                  type="date"
                  readOnly={!canEdit}
                  value={srfData.date}
                  onChange={(e) => handleSrfChange("date", e.target.value)}
                  className={`block w-full rounded-lg border-gray-300 px-3 py-2 text-sm ${canEdit ? "bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" : "bg-gray-50 cursor-not-allowed"}`}
                />
             </div>
          </div>

          {/* Row 2: Company Name */}
          <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company Name</label>
              <div className="flex items-center w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                 <Building size={18} className="mr-2 text-gray-500"/>
                 {srfData.company_name}
              </div>
          </div>

          {/* Row 3: Addresses (Read Only - Side by Side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Bill To */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 relative">
                 <div className="flex items-center gap-2 mb-2">
                    <MapPin size={16} className="text-blue-600"/>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Bill To Address</label>
                 </div>
                 <textarea
                    rows={3}
                    readOnly={true}
                    value={srfData.bill_to_address}
                    className="block w-full rounded border-0 bg-transparent text-sm text-gray-600 resize-none focus:ring-0 p-0"
                 />
              </div>

              {/* Ship To */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 relative">
                 <div className="flex items-center gap-2 mb-2">
                    <MapPin size={16} className="text-green-600"/>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Ship To Address</label>
                 </div>
                 <textarea
                    rows={3}
                    readOnly={true}
                    value={srfData.ship_to_address}
                    className="block w-full rounded border-0 bg-transparent text-sm text-gray-600 resize-none focus:ring-0 p-0"
                 />
              </div>
          </div>

          {/* Row 4: Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contact Person</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={16} className="text-gray-400"/>
                   </div>
                   <input
                      type="text"
                      readOnly={!canEdit}
                      value={srfData.contact_person}
                      onChange={(e) => handleSrfChange("contact_person", e.target.value)}
                      className={`block w-full pl-10 rounded-lg border-gray-300 text-sm ${canEdit ? "bg-white" : "bg-gray-50 cursor-not-allowed"}`}
                   />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone size={16} className="text-gray-400"/>
                   </div>
                   <input
                      type="text"
                      readOnly={!canEdit}
                      value={srfData.phone}
                      onChange={(e) => handleSrfChange("phone", e.target.value)}
                      className={`block w-full pl-10 rounded-lg border-gray-300 text-sm ${canEdit ? "bg-white" : "bg-gray-50 cursor-not-allowed"}`}
                   />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={16} className="text-gray-400"/>
                   </div>
                   <input
                      type="email"
                      readOnly={!canEdit}
                      value={srfData.email}
                      onChange={(e) => handleSrfChange("email", e.target.value)}
                      className={`block w-full pl-10 rounded-lg border-gray-300 text-sm ${canEdit ? "bg-white" : "bg-gray-50 cursor-not-allowed"}`}
                   />
                </div>
              </div>
          </div>

          {/* Row 5: Certificate Issue Details (Stacked Vertically) */}
          <div className="space-y-6">
              {/* Certificate Issue Name */}
              <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Certificate Issue Name</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                       <Award size={16} className="text-indigo-500"/>
                    </div>
                    <input
                        type="text"
                        readOnly={!canEdit}
                        value={srfData.certificate_issue_name}
                        onChange={(e) => handleSrfChange("certificate_issue_name", e.target.value)}
                        className={`block w-full pl-10 rounded-lg border-gray-300 text-sm ${canEdit ? "bg-white" : "bg-gray-50 cursor-not-allowed"}`}
                     />
                 </div>
              </div>

              {/* Certificate Issue Address */}
              <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Certificate Issue Address</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 pt-2.5 flex items-start pointer-events-none">
                       <Home size={16} className="text-indigo-500"/>
                    </div>
                    <textarea
                        rows={2}
                        readOnly={!canEdit}
                        value={srfData.certificate_issue_adress || ""}
                        onChange={(e) => handleSrfChange("certificate_issue_adress", e.target.value)}
                        className={`block w-full pl-10 rounded-lg border-gray-300 text-sm ${canEdit ? "bg-white" : "bg-gray-50 cursor-not-allowed"}`}
                        placeholder="Same as Bill To if empty"
                    />
                 </div>
              </div>
          </div>
        </fieldset>
        
        {/* --- SPECIAL INSTRUCTIONS (Visible ONLY when Approved/Rejected, and always Read Only) --- */}
        {showSpecialInstructions && (
          <fieldset className="mb-10 border border-gray-300 rounded-2xl bg-gray-50 p-6">
            <legend className="flex items-center gap-2 px-3 py-1.5 text-lg font-semibold text-gray-800 bg-white rounded-md shadow-sm">
              <BookOpen className="h-5 w-5 text-indigo-600" /> Special Instructions from customer for calibration
            </legend>

            {/* 1. Calibration Frequency */}
            <div className="mb-6">
              <strong className="text-gray-800 text-sm block mb-3">1. Calibration Frequency:</strong>
              <div className="flex flex-col md:flex-row gap-4 ml-2 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="freq"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    checked={srfData.calibration_frequency === "As per Standard"}
                    disabled={true}
                  />
                  As per Standard
                </label>
                
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="freq"
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      checked={srfData.calibration_frequency !== "As per Standard"}
                      disabled={true}
                    />
                    Specify
                  </label>
                  {srfData.calibration_frequency !== "As per Standard" && (
                    <input
                      type="text"
                      className="border border-gray-300 rounded-lg px-3 py-1.5 w-64 text-sm bg-gray-100 cursor-not-allowed"
                      value={srfData.calibration_frequency || ""}
                      readOnly={true}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 2. Statement of Conformity */}
            <div className="mb-6">
              <strong className="text-gray-800 text-sm block mb-3">2. Required 'Statement of conformity' to be reported in the Calibration Certificate?</strong>
              <div className="flex gap-6 ml-2 text-sm text-gray-700">
                <label className="flex items-center gap-2 cursor-not-allowed">
                  <input
                    type="radio"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    checked={srfData.statement_of_conformity === true}
                    disabled={true}
                  />
                  YES
                </label>
                <label className="flex items-center gap-2 cursor-not-allowed">
                  <input
                    type="radio"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    checked={srfData.statement_of_conformity === false}
                    disabled={true}
                  />
                  NO
                </label>
              </div>
            </div>

            {/* 2.1 Decision Rules (Conditional) */}
            {srfData.statement_of_conformity && (
              <div className="mb-6 ml-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <strong className="text-gray-800 text-sm block mb-3">2.1 Decision Rule (tick √):</strong>
                <div className="flex flex-col gap-2 text-sm text-gray-700">
                  {[
                    ["ref_iso_is_doc", "Reference to ISO/IS Doc. Standard"],
                    ["ref_manufacturer_manual", "Reference to manufacturer Instruction Manual"],
                    ["ref_customer_requirement", "Reference to Customer Requirement"]
                  ].map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2 cursor-not-allowed">
                      <input
                        type="checkbox"
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                        checked={!!(srfData as any)[field]}
                        disabled={true}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Turnaround Time & Remarks */}
            <div className="grid gap-6 md:grid-cols-2 mt-6 border-t pt-6">
              <div>
                <strong className="text-gray-800 text-sm block mb-2">3. Turnaround time (Days):</strong>
                <input
                  type="number"
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full max-w-xs text-sm bg-gray-100 cursor-not-allowed"
                  value={srfData.turnaround_time || ""}
                  readOnly={true}
                />
              </div>
              <div>
                <strong className="text-gray-800 text-sm block mb-2">Additional Details / Remarks:</strong>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-100 cursor-not-allowed"
                  value={srfData.remarks || ""}
                  readOnly={true}
                />
              </div>
            </div>
          </fieldset>
        )}

        {/* Equipment Table */}
        <fieldset className="border border-gray-300 rounded-2xl p-6 bg-gray-50 mb-10">
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
                    <td className="px-2 py-1"><select className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${canEdit ? "cursor-pointer bg-white" : "cursor-not-allowed bg-gray-100"}`} value={eq.srf_equipment?.unit || ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "unit", e.target.value)} disabled={!canEdit}><option value="">Select Unit</option>{unitOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}</select></td>
                    <td className="px-2 py-1"><input type="text" className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${canEdit ? "bg-white" : "bg-gray-100 cursor-not-allowed"}`} readOnly={!canEdit} value={eq.srf_equipment?.no_of_calibration_points ?? ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "no_of_calibration_points", e.target.value)} /></td>
                    <td className="px-2 py-1"><input type="text" className={`block w-full rounded-lg border-gray-300 px-2 py-1 text-sm ${canEdit ? "bg-white" : "bg-gray-100 cursor-not-allowed"}`} readOnly={!canEdit} value={eq.srf_equipment?.mode_of_calibration || ""} onChange={(e) => handleSrfEquipmentChange(eq.inward_eqp_id, "mode_of_calibration", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>

        {/* Actions */}
        {canEdit && (
          <div className="flex justify-end items-center gap-4 pt-8 mt-8 border-t border-gray-200">
            <button className="px-5 py-2.5 rounded-lg font-medium text-gray-800 bg-gray-200 hover:bg-gray-300 transition" onClick={() => navigate("/engineer/srfs")}>Cancel</button>
            <button
                className="px-5 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition disabled:opacity-60"
                // CHANGED: Check for 'draft' as well when deciding to submit as 'inward_completed'
                onClick={() => handleSaveSrf((srfData.status === "created" || srfData.status === "draft") ? "inward_completed" : srfData.status, true)}
                disabled={autoSaving}
            >
              {activeSrfId ? "Save Changes & Submit" : "Create SRF & Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SrfDetailPage;