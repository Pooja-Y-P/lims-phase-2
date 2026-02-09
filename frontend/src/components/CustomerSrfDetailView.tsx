import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  UserCircle,
  BookOpen,
  Check,
  X,
  Lightbulb,
  Wrench,
  ChevronLeft,
} from "lucide-react";
 
// --- Interfaces (Updated to match your JSON) ---
type SrfStatus = 'approved' | 'rejected' | 'pending' | 'inward_completed' | 'created';
 
interface SrfEquipmentData {
  unit?: string | null;
  no_of_calibration_points?: string;
  mode_of_calibration?: string;
}
 
interface EquipmentData {
  inward_eqp_id: number;
  material_description?: string;
  model?: string;
  serial_no?: string;
  range?: string;
  srf_equipment?: SrfEquipmentData;
}
 
interface CustomerData {
  customer_id?: number;
  customer_details?: string; // This serves as the Company Name
  phone?: string;
  contact_person?: string;
  email?: string;
  bill_to_address?: string; // Matches JSON
  ship_to_address?: string; // Matches JSON
}
 
interface InwardData {
  inward_id: number;
  customer_dc_no?: string;
  customer_dc_date?: string;
  material_inward_date?: string; // Matches JSON
  customer?: CustomerData;
  equipments?: EquipmentData[];
}
 
interface SrfData {
  srf_id: number;
  date: string; // SRF Date
  nepl_srf_no: string;
  status: SrfStatus;
 
  // Contact Info
  telephone: string | null;
  email: string | null;
  contact_person: string | null;
  address?: string | null;
 
  // Certificate Info
  certificate_issue_name: string | null;
  // Note: JSON has a typo 'adress', mapping both for safety
  certificate_issue_adress?: string | null;
  certificate_issue_address?: string | null;
 
  inward?: InwardData;
 
  // Instructions
  calibration_frequency: string;
  statement_of_conformity: boolean;
  ref_iso_is_doc?: boolean;
  ref_manufacturer_manual?: boolean;
  ref_customer_requirement?: boolean;
  turnaround_time?: string | number; // JSON returns number 7
  remarks?: string | null;
  remark_special_instructions?: string | null;
  specified_frequency?: string;
}
 
// Props interface for the component
interface Props {
  onStatusChange: (id: number, status: string) => void;
}
 
const CustomerSrfDetailView: React.FC<Props> = ({ onStatusChange }) => {
  const { srfId } = useParams<{ srfId: string }>();
  const [srfData, setSrfData] = useState<SrfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
 
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
 
  // --- Data Loading ---
  const loadSrfData = useCallback(async () => {
    if (!srfId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://192.168.31.195:8000/api/srfs/${srfId}`);
      if (!response.ok) throw new Error("Failed to fetch SRF details");
      const data: SrfData = await response.json();
     
      // --- Data Normalization ---
 
      // 1. Date Formatting
      if (data.date) data.date = data.date.split("T")[0];
     
      // 2. Inward Data Formatting
      if (data.inward) {
        if (data.inward.customer_dc_date) {
            data.inward.customer_dc_date = data.inward.customer_dc_date.split("T")[0];
        }
        // Handle 'material_inward_date' from JSON
        if (data.inward.material_inward_date) {
            data.inward.material_inward_date = data.inward.material_inward_date.split("T")[0];
        }
      }
 
      // 3. Handle JSON typo: certificate_issue_adress -> certificate_issue_address
      // We store it in the standard 'address' field for the state
      const certAddr = data.certificate_issue_address || data.certificate_issue_adress;
      data.certificate_issue_address = certAddr;
 
      // 4. Convert Turnaround time to string if it's a number
      if (typeof data.turnaround_time === 'number') {
          data.turnaround_time = data.turnaround_time.toString();
      }
 
      // 5. Defaults
      data.calibration_frequency = data.calibration_frequency ?? "As per Standard";
      data.statement_of_conformity = typeof data.statement_of_conformity === "boolean" ? data.statement_of_conformity : false;
     
      setSrfData(data);
    } catch (err: any) {
      console.error("Error loading SRF:", err);
      setError(err.message || "Error loading SRF details");
    } finally {
      setLoading(false);
    }
  }, [srfId]);
 
  useEffect(() => {
    loadSrfData();
  }, [loadSrfData]);
 
  const handleSrfChange = (key: keyof SrfData, value: any) => {
    setSrfData((prev: SrfData | null) => (prev ? { ...prev, [key]: value } : null));
  };
 
  const saveAndUpdateStatus = async (status: SrfStatus, remarks?: string) => {
    if (!srfData) return;
    setIsSubmitting(true);
    try {
      // Construct payload
      const payload: Partial<SrfData> = {
        status,
        telephone: srfData.telephone,
        email: srfData.email,
        contact_person: srfData.contact_person,
        certificate_issue_name: srfData.certificate_issue_name,
        // Send back both spellings to be safe or just the one the backend expects
        certificate_issue_adress: srfData.certificate_issue_address,
        calibration_frequency: srfData.calibration_frequency,
        specified_frequency: srfData.specified_frequency,
        statement_of_conformity: srfData.statement_of_conformity,
        ref_iso_is_doc: srfData.ref_iso_is_doc,
        ref_manufacturer_manual: srfData.ref_manufacturer_manual,
        ref_customer_requirement: srfData.ref_customer_requirement,
        turnaround_time: srfData.turnaround_time,
        remarks: srfData.remarks,
        remark_special_instructions: srfData.remark_special_instructions,
      };
     
      if (status === 'rejected' && remarks) {
        payload.remarks = remarks;
      }
 
      const response = await fetch(`http://192.168.31.195:8000/api/srfs/${srfData.srf_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
 
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${status} SRF`);
      }
     
      const updatedSrfData: SrfData = {
        ...srfData,
        status,
        remarks: status === 'rejected' ? remarks : srfData.remarks };
      setSrfData(updatedSrfData);
      onStatusChange(srfData.srf_id, status);
     
      if (status === 'rejected') {
        setShowRejectionModal(false);
        setRejectionReason("");
      }
      alert(`SRF ${status} successfully!`);
    } catch (err: any) {
      alert(err.message || "Error updating SRF");
    } finally {
      setIsSubmitting(false);
    }
  };
 
  const handleRejectSubmit = () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    saveAndUpdateStatus("rejected", rejectionReason);
  };
 
  // --- UI State & Classes ---
  if (loading) return <div className="flex items-center justify-center h-96 text-slate-500">Loading SRF Details...</div>;
  if (error) return <div className="p-8 text-center text-red-700 bg-red-50 rounded-lg border border-red-200">{error}</div>;
  if (!srfData) return <div className="flex items-center justify-center h-96 text-slate-500">SRF not found.</div>;
 
  const isReadOnly = srfData.status === 'approved' || srfData.status === 'rejected';
 
  const readOnlyInputClasses = "block w-full rounded-md bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed sm:text-sm focus:ring-0 focus:border-slate-200";
  const editableInputClasses = "block w-full rounded-md border-slate-300 shadow-sm sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-150";
 
  const statusInfo = ({
    approved: { label: "Approved", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-4 w-4" /> },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> },
    pending: { label: "Pending Your Approval", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" /> },
    inward_completed: { label: "Pending Your Approval", color: "bg-blue-100 text-blue-800", icon: <Clock className="h-4 w-4" /> },
    created: { label: "New", color: "bg-slate-100 text-slate-800", icon: <FileText className="h-4 w-4" /> },
  } as const)[srfData.status] || { label: srfData.status, color: "bg-slate-100 text-slate-800", icon: <FileText className="h-4 w-4" /> };
 
  // Determine display value for Customer Name (from JSON: inward.customer.customer_details)
  const customerNameDisplay = srfData.inward?.customer?.customer_details || "";
 
  return (
    <>
      <div className="p-6 md:p-8 bg-white rounded-2xl shadow-lg border border-slate-200 space-y-10">
        {/* --- Header --- */}
        <header className="border-b border-slate-200 pb-6">
          <div className="flex justify-between items-center mb-2">
            <Link to="/customer/view-srf" className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold transition-colors flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Back to SRF List
            </Link>
            <div className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-full ${statusInfo.color}`}>
              {statusInfo.icon}
              {statusInfo.label}
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-800">SRF Details</h1>
          <p className="text-slate-500 mt-2">Please review the details below. You can edit contact information and special instructions before approving.</p>
        </header>
 
        {srfData.status === 'rejected' && srfData.remarks && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex"><div className="flex-shrink-0"><XCircle className="h-5 w-5 text-red-500" /></div><div className="ml-3"><h3 className="text-sm font-medium text-red-800">Rejection Reason</h3><p className="mt-1 text-sm text-red-700">{srfData.remarks}</p></div></div>
          </div>
        )}
       
        {/* --- Section: Customer Details --- */}
        <section className="border border-slate-200 rounded-xl">
          <div className="p-6 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <UserCircle className="h-7 w-7 text-indigo-500" />
              <h3 className="text-xl font-semibold text-slate-800">Customer Details</h3>
            </div>
          </div>
         
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
           
            {/* Row 1: Logistics & IDs */}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer DC No</label>
                {/* Matches: inward.customer_dc_no */}
                <input className={readOnlyInputClasses} readOnly value={srfData.inward?.customer_dc_no || "N/A"} />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer DC Date</label>
                {/* Matches: inward.customer_dc_date */}
                <input type="date" className={readOnlyInputClasses} readOnly value={srfData.inward?.customer_dc_date || ""} />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference (SRF No)</label>
                {/* Matches: nepl_srf_no */}
                <input className={readOnlyInputClasses} readOnly value={srfData.nepl_srf_no} />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Material Inward Date</label>
                {/* Matches: inward.material_inward_date */}
                <input type="date" className={readOnlyInputClasses} readOnly value={srfData.inward?.material_inward_date || ""} />
            </div>
 
            {/* Row 2: Company Info */}
            <div className="lg:col-span-4 border-t border-slate-100 pt-2 mt-2">
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
                 {/* Matches: inward.customer.customer_details */}
                 <input className={`text-lg font-semibold ${readOnlyInputClasses}`} readOnly value={customerNameDisplay} />
            </div>
 
            {/* Row 3: Addresses */}
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bill To Address</label>
                {/* Matches: inward.customer.bill_to_address */}
                <textarea rows={3} className={readOnlyInputClasses} readOnly value={srfData.inward?.customer?.bill_to_address || ""} />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ship To Address</label>
                {/* Matches: inward.customer.ship_to_address */}
                <textarea rows={3} className={readOnlyInputClasses} readOnly value={srfData.inward?.customer?.ship_to_address || ""} />
            </div>
 
            {/* Row 4: Contact Info (Editable) */}
            <div className="lg:col-span-4 border-t border-slate-100 pt-2 mt-2">
                <h4 className="text-sm font-semibold text-indigo-600 mb-3">Contact Information</h4>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Person</label>
                {/* Matches: top-level contact_person */}
                <input
                    className={isReadOnly ? readOnlyInputClasses : editableInputClasses}
                    value={srfData.contact_person || ""}
                    onChange={(e) => handleSrfChange("contact_person", e.target.value)}
                    readOnly={isReadOnly}
                />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                {/* Matches: top-level telephone */}
                <input
                    className={isReadOnly ? readOnlyInputClasses : editableInputClasses}
                    value={srfData.telephone || ""}
                    onChange={(e) => handleSrfChange("telephone", e.target.value)}
                    readOnly={isReadOnly}
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                {/* Matches: top-level email */}
                <input
                    type="email"
                    className={isReadOnly ? readOnlyInputClasses : editableInputClasses}
                    value={srfData.email || ""}
                    onChange={(e) => handleSrfChange("email", e.target.value)}
                    readOnly={isReadOnly}
                />
            </div>
 
            {/* Row 5: Certificate Info (Editable) */}
            <div className="lg:col-span-4 border-t border-slate-100 pt-2 mt-2">
                <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    <h4 className="text-sm font-semibold text-indigo-600">Certificate Information</h4>
                </div>
            </div>
           
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Certificate Issue Name</label>
                {/* Matches: certificate_issue_name */}
                <input
                    className={isReadOnly ? readOnlyInputClasses : editableInputClasses}
                    value={srfData.certificate_issue_name || ""}
                    onChange={(e) => handleSrfChange("certificate_issue_name", e.target.value)}
                    placeholder="Same as Company Name"
                    readOnly={isReadOnly}
                />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Certificate Issue Address</label>
                {/* Matches: certificate_issue_address (normalized from JSON typo) */}
                <textarea
                    rows={2}
                    className={isReadOnly ? readOnlyInputClasses : editableInputClasses}
                    value={srfData.certificate_issue_address || ""}
                    onChange={(e) => handleSrfChange("certificate_issue_address", e.target.value)}
                    placeholder="Same as Bill To Address"
                    readOnly={isReadOnly}
                />
            </div>
 
          </div>
        </section>
 
        {/* --- Special Instructions Section --- */}
        <section className="border border-slate-200 rounded-xl">
            <div className="p-6 border-b border-slate-200 bg-slate-50 rounded-t-xl"><div className="flex items-center gap-3"><BookOpen className="h-7 w-7 text-indigo-500" /><h3 className="text-xl font-semibold text-slate-800">Special Instructions</h3></div></div>
            <div className="p-6 space-y-8">
                <div><strong className="text-slate-900 text-base font-semibold">1. Calibration Frequency:</strong><div className="flex flex-col gap-3 mt-3 text-slate-700"><label className="flex items-center gap-3 cursor-pointer w-fit"><input type="radio" name="freq" checked={srfData.calibration_frequency === "As per Standard"} onChange={() => handleSrfChange("calibration_frequency", "As per Standard")} disabled={isReadOnly} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" /> As per Standard</label><label className="flex items-center gap-3 cursor-pointer w-fit"><input type="radio" name="freq" checked={srfData.calibration_frequency !== "As per Standard"} onChange={() => !isReadOnly && srfData.calibration_frequency === "As per Standard" && handleSrfChange("calibration_frequency", "")} disabled={isReadOnly} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" /> Specify</label>{srfData.calibration_frequency !== "As per Standard" && (<input type="text" className={`mt-1 w-full max-w-sm ${isReadOnly ? readOnlyInputClasses : editableInputClasses}`} value={srfData.calibration_frequency || ""} onChange={(e) => handleSrfChange("calibration_frequency", e.target.value)} placeholder="e.g., 12 Months" readOnly={isReadOnly} />)}</div></div>
                <div><strong className="text-slate-900 text-base font-semibold">2. Statement of conformity required?</strong><div className="flex gap-6 mt-3 text-slate-700"><label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={srfData.statement_of_conformity === true} onChange={() => handleSrfChange("statement_of_conformity", true)} disabled={isReadOnly} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" /> YES</label><label className="flex items-center gap-3 cursor-pointer"><input type="radio" checked={srfData.statement_of_conformity === false} onChange={() => handleSrfChange("statement_of_conformity", false)} disabled={isReadOnly} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" /> NO</label></div>{srfData.statement_of_conformity && (<div className="mt-4 pl-6 border-l-2 border-slate-200"><strong className="text-slate-800 text-base font-semibold">2.1 Decision Rule:</strong><div className="flex flex-col gap-3 mt-3 text-slate-700"><label className="flex items-center gap-3 cursor-pointer w-fit"><input type="checkbox" checked={srfData.ref_iso_is_doc} onChange={e => handleSrfChange("ref_iso_is_doc", e.target.checked)} disabled={isReadOnly} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" /> Ref. ISO/IS Doc. Standard</label><label className="flex items-center gap-3 cursor-pointer w-fit"><input type="checkbox" checked={srfData.ref_manufacturer_manual} onChange={e => handleSrfChange("ref_manufacturer_manual", e.target.checked)} disabled={isReadOnly} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" /> Ref. manufacturer Manual</label><label className="flex items-center gap-3 cursor-pointer w-fit"><input type="checkbox" checked={srfData.ref_customer_requirement} onChange={e => handleSrfChange("ref_customer_requirement", e.target.checked)} disabled={isReadOnly} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500" /> Ref. Customer Requirement</label></div></div>)}</div>
                <div><strong className="text-slate-900 text-base font-semibold">3. Turnaround time:</strong><input className={`mt-2 w-full max-w-sm ${isReadOnly ? readOnlyInputClasses : editableInputClasses}`} value={srfData.turnaround_time || ""} onChange={e => handleSrfChange("turnaround_time", e.target.value)} placeholder="e.g., 7 business days" readOnly={isReadOnly} /></div>
            </div>
            <div className="p-6 pt-0">
                <strong className="text-slate-900 text-base font-semibold">4. Additional Notes:</strong>
                <p className="text-sm text-slate-500 mt-1 mb-2">Any other specific instructions or comments for our team can be added here.</p>
                <textarea
                    rows={3}
                    className={`w-full ${isReadOnly ? readOnlyInputClasses : editableInputClasses}`}
                    value={srfData.remark_special_instructions || ""}
                    onChange={(e) => handleSrfChange("remark_special_instructions", e.target.value)}
                    placeholder="e.g., 'Please handle with extra care', 'Call before delivery'"
                    readOnly={isReadOnly}
                />
            </div>
        </section>
 
        <section className="border border-slate-200 rounded-xl">
            <div className="p-6 border-b border-slate-200 bg-slate-50 rounded-t-xl"><div className="flex items-center gap-3"><Wrench className="h-7 w-7 text-indigo-500" /><h3 className="text-xl font-semibold text-slate-800">Equipment Details</h3></div></div>
            <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-xs text-slate-600 uppercase bg-slate-100 font-semibold">
                <tr><th className="px-3 py-3">Instrument</th><th className="px-3 py-3">Model</th><th className="px-3 py-3">Serial No</th><th className="px-3 py-3">Range</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3">Cal. Points</th><th className="px-3 py-3">Mode of Cal.</th></tr>
            </thead><tbody className="divide-y divide-slate-200">
                {srfData.inward?.equipments?.map((eq: EquipmentData) => (<tr key={eq.inward_eqp_id} className="even:bg-slate-50/50">
                    <td className="px-2 py-2 w-1/5"><input type="text" className={readOnlyInputClasses} readOnly value={eq.material_description || ""} /></td>
                    <td className="px-2 py-2 w-1/6"><input type="text" className={readOnlyInputClasses} readOnly value={eq.model || ""} /></td>
                    <td className="px-2 py-2 w-1/6"><input type="text" className={readOnlyInputClasses} readOnly value={eq.serial_no || ""} /></td>
                    <td className="px-2 py-2 w-1/6"><input type="text" className={readOnlyInputClasses} readOnly value={eq.range || ""} /></td>
                    <td className="px-2 py-2"><input type="text" className={readOnlyInputClasses} readOnly value={eq.srf_equipment?.unit || ""} /></td>
                    <td className="px-2 py-2"><input type="text" className={readOnlyInputClasses} readOnly value={eq.srf_equipment?.no_of_calibration_points || ""} /></td>
                    <td className="px-2 py-2"><input type="text" className={readOnlyInputClasses} readOnly value={eq.srf_equipment?.mode_of_calibration || ""} /></td>
                </tr>))}
            </tbody></table></div>
        </section>
 
        {!isReadOnly && (
          <footer className="flex justify-end items-center gap-4 pt-8 border-t border-slate-200">
            <button className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition-all disabled:opacity-60 disabled:cursor-not-allowed" onClick={() => setShowRejectionModal(true)} disabled={isSubmitting}><X className="h-5 w-5" /> Reject</button>
            <button className="flex items-center justify-center gap-2 px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition-all disabled:opacity-60 disabled:cursor-not-allowed" onClick={() => saveAndUpdateStatus("approved")} disabled={isSubmitting}><Check className="h-5 w-5" /> Approve</button>
          </footer>
        )}
      </div>
 
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 transition-opacity"><div className="bg-white rounded-lg shadow-xl max-w-md w-full"><div className="p-6"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-100 rounded-full"><XCircle className="h-6 w-6 text-red-600" /></div><h3 className="text-xl font-semibold text-slate-900">Confirm Rejection</h3></div><p className="text-slate-600 mb-4">Please provide a clear reason for rejecting this SRF. This will be sent to our team to make the necessary corrections.</p><div><label htmlFor="rejection-reason" className="block text-sm font-medium text-slate-700 mb-1.5">Reason for Rejection <span className="text-red-500">*</span></label><textarea id="rejection-reason" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500" rows={4} placeholder="e.g., 'The calibration points for the torque wrench are incorrect...'" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} maxLength={500} /><p className="text-xs text-slate-500 mt-1 text-right">{rejectionReason.length}/500 characters</p></div><div className="flex gap-3 justify-end mt-6"><button className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors" onClick={() => setShowRejectionModal(false)} disabled={isSubmitting}>Cancel</button><button className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleRejectSubmit} disabled={isSubmitting || !rejectionReason.trim()}>{isSubmitting ? "Submitting..." : "Confirm Rejection"}</button></div></div></div></div>
      )}
    </>
  );
};
 
export default CustomerSrfDetailView;
 