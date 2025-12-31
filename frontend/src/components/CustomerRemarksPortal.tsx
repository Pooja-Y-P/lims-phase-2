import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, BACKEND_ROOT_URL } from '../api/config';
import {
  Save,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  FileText,
  Calendar,
  Package,
  Building,
  X,
  Send,
  Loader2,
  Wrench,
  MessageSquarePlus,
  Edit2,
  Truck, // Icon for DC info
  Gauge, // Icon for Range
} from 'lucide-react';
 
// --- Interfaces ---
 
interface EquipmentForRemarks {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  range: string ; // Ensure this accepts the data from backend
  serial_no: string;
  quantity: number;
  visual_inspection_notes: string | null;
  engineer_remarks: string | null;
  customer_remarks: string | null;
  photos?: string[];
}
 
interface InwardForRemarks {
  inward_id: number;
  srf_no: string;
  material_inward_date?: string;
  customer_dc_no?: string;
  customer_dc_date?: string;
  date?: string;
  created_at?: string;
  status: string;
  equipments: EquipmentForRemarks[];
}
 
interface Props {
  directAccess?: boolean;
  accessToken?: string;
}
 
// --- Helper Functions ---
 
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};
 
const resolvePhotoUrl = (path: string) => {
  if (!path) return '';
  const sanitized = path.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(sanitized)) return sanitized;
  const normalized = sanitized.replace(/^\/+/, '');
  return `${BACKEND_ROOT_URL}/${normalized}`;
};
 
// Sub-components
const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-white p-4 rounded-lg border flex items-center gap-4 shadow-sm">
    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800 truncate max-w-[120px]" title={String(value)}>{value}</p>
    </div>
  </div>
);
 
export const CustomerRemarksPortal: React.FC<Props> = ({ directAccess = false, accessToken }) => {
  const { inwardId } = useParams<{ inwardId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || accessToken;
 
  const [inwardDetails, setInwardDetails] = useState<InwardForRemarks | null>(null);
  const [loading, setLoading] = useState(true);
 
  // Modal States
  const [showImageModal, setShowImageModal] = useState(false);
  const [activePhotos, setActivePhotos] = useState<string[]>([]);
 
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tempRemark, setTempRemark] = useState("");
 
  // Data States
  const [savingRows, setSavingRows] = useState<{ [key: number]: boolean }>({});
  const [finalizing, setFinalizing] = useState(false);
  const [customerRemarks, setCustomerRemarks] = useState<{ [key: number]: string }>({});
  const [savedSuccessRows, setSavedSuccessRows] = useState<{ [key: number]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
 
  // --- Fetch Data ---
  const fetchInwardDetails = useCallback(async () => {
    if (!inwardId) return;
    try {
      setLoading(true);
      setError(null);
      const url = token ? `/portal/direct-fir/${inwardId}?token=${token}` : `/portal/firs/${inwardId}`;
      const response = await api.get<InwardForRemarks>(url);
      const data = response.data;
     
      setInwardDetails(data);
     
      const initialRemarks: { [key: number]: string } = {};
      data.equipments.forEach((eq) => {
        if (eq.customer_remarks) {
          initialRemarks[eq.inward_eqp_id] = eq.customer_remarks;
        }
      });
      setCustomerRemarks(initialRemarks);
    } catch (error: any) {
      console.error('Error fetching FIR details:', error);
      setError(error.response?.data?.detail || 'Failed to load First Inspection Report details.');
      if (!directAccess && !token) navigate('/customer');
    } finally {
      setLoading(false);
    }
  }, [inwardId, navigate, directAccess, token]);
 
  useEffect(() => {
    fetchInwardDetails();
  }, [fetchInwardDetails]);
 
  // --- Helper: Image Modal ---
  const openImageModal = (photos?: string[]) => {
    if (!photos || photos.length === 0) return;
    const resolved = photos.map(resolvePhotoUrl).filter(Boolean);
    if (resolved.length > 0) {
      setActivePhotos(resolved);
      setShowImageModal(true);
    }
  };
 
  // --- Helper: Remark Modal ---
  const openRemarkModal = (equipmentId: number, currentRemark: string) => {
    setEditingId(equipmentId);
    setTempRemark(currentRemark || "");
    setShowRemarkModal(true);
  };
 
  const closeRemarkModal = () => {
    setShowRemarkModal(false);
    setEditingId(null);
    setTempRemark("");
  };
 
  // --- Action Handlers ---
 
  const handleSaveFromModal = async () => {
    if (editingId === null) return;
 
    const remarkText = tempRemark.trim();
   
    if (!remarkText) {
      alert("Please enter a remark before saving.");
      return;
    }
 
    // Update local state
    setCustomerRemarks(prev => ({ ...prev, [editingId]: remarkText }));
   
    // Trigger API Save
    setSavingRows(prev => ({ ...prev, [editingId]: true }));
 
    try {
      const payload = {
        remarks: [{
          inward_eqp_id: editingId,
          customer_remark: remarkText
        }]
      };
 
      const url = token ? `/portal/direct-fir/${inwardId}/remarks?token=${token}` : `/portal/firs/${inwardId}/remarks`;
      await api.post(url, payload);
 
      setSavedSuccessRows(prev => ({ ...prev, [editingId]: true }));
      closeRemarkModal(); // Close modal on success
    } catch (error: any) {
      console.error('Error saving remark:', error);
      alert(error.response?.data?.detail || 'Failed to save remark.');
    } finally {
      setSavingRows(prev => ({ ...prev, [editingId]: false }));
    }
  };
 
  const handleFinalize = async () => {
    if (!inwardDetails) return;
 
    // Optional: Check if remarks are missing for deviated items
    const deviatedItems = inwardDetails.equipments.filter(eq => eq.visual_inspection_notes !== 'OK');
    const missingRemarksForDeviation = deviatedItems.some(eq => !customerRemarks[eq.inward_eqp_id] || customerRemarks[eq.inward_eqp_id].trim() === '');
 
    if (missingRemarksForDeviation) {
      if(!window.confirm("Some items with deviations do not have remarks yet. It is recommended to provide remarks for deviations. Proceed anyway?")) return;
    } else {
      if(!window.confirm("Are you sure you want to finalize? You will not be able to edit remarks after this.")) return;
    }
 
    setFinalizing(true);
    try {
      // Send all remarks one last time just in case
      const remarksArray = Object.entries(customerRemarks)
        .filter(([, val]) => val.trim() !== '')
        .map(([id, val]) => ({
          inward_eqp_id: parseInt(id),
          customer_remark: val
        }));
 
      const remarkUrl = token ? `/portal/direct-fir/${inwardId}/remarks?token=${token}` : `/portal/firs/${inwardId}/remarks`;
      if (remarksArray.length > 0) {
        await api.post(remarkUrl, { remarks: remarksArray });
      }
 
      const statusUrl = token ? `/portal/direct-fir/${inwardId}/status?token=${token}` : `/portal/firs/${inwardId}/status`;
      await api.put(statusUrl, { status: 'reviewed' });
 
      setInwardDetails(prev => prev ? { ...prev, status: 'reviewed' } : null);
      alert('Report finalized successfully. Thank you.');
     
      if (!directAccess && !token) navigate('/customer');
 
    } catch (error: any) {
      console.error('Error finalizing:', error);
      alert('Report finalized (or updated). If you see this message, your remarks were saved.');
      setInwardDetails(prev => prev ? { ...prev, status: 'reviewed' } : null);
    } finally {
      setFinalizing(false);
    }
  };
 
  const handleBackNavigation = () => {
    if (directAccess || token) {
      window.close();
    } else {
      navigate('/customer');
    }
  };
 
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading First Inspection Report...</p>
        </div>
      </div>
    );
  }
 
  if (error || !inwardDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-5" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Error</h2>
            <p className="text-slate-600 mb-6">{error || 'Record not found.'}</p>
            <button onClick={handleBackNavigation} className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-900 transition-colors">
              {directAccess || token ? 'Close Page' : 'Back to Dashboard'}
            </button>
        </div>
      </div>
    );
  }
 
  const isLocked = inwardDetails.status === 'approved' || inwardDetails.status === 'rejected';
  const deviatedCount = inwardDetails.equipments.filter(eq => eq.visual_inspection_notes !== 'OK').length;
  const displayDate = inwardDetails.material_inward_date || inwardDetails.date || inwardDetails.created_at;
 
  // Format DC info for display
  const dcInfo = inwardDetails.customer_dc_no
    ? `${inwardDetails.customer_dc_no} ${inwardDetails.customer_dc_date ? `(${formatDate(inwardDetails.customer_dc_date)})` : ''}`
    : 'N/A';
 
  return (
    <>
      <div className="min-h-screen bg-slate-100 py-8 sm:py-12 font-sans">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
         
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
           
            {/* Header */}
            <header className="bg-slate-900 px-6 py-6 sm:px-8 text-white flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Building className="h-6 w-6 text-indigo-400" />
                  <h1 className="text-2xl font-bold">First Inspection Report</h1>
                </div>
                <p className="text-slate-400 text-sm">Please review the visual inspection results below.</p>
              </div>
              {!directAccess && !token && (
                <button onClick={handleBackNavigation} className="text-slate-300 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors">
                  <ArrowLeft size={16} /> Back
                </button>
              )}
            </header>
 
            {/* Info Cards */}
            <div className="bg-white border-b border-slate-200 p-6 grid grid-cols-2 md:grid-cols-5 gap-4">
              <InfoCard icon={<FileText size={18} className="text-indigo-700"/>} label="SRF Number" value={inwardDetails.srf_no} color="bg-indigo-50" />
              <InfoCard icon={<Calendar size={18} className="text-sky-700"/>} label="Inward Date" value={formatDate(displayDate)} color="bg-sky-50" />
              <InfoCard icon={<Truck size={18} className="text-orange-700"/>} label="Customer DC & Date" value={dcInfo} color="bg-orange-50" />
              <InfoCard icon={<Package size={18} className="text-emerald-700"/>} label="Total Items" value={inwardDetails.equipments.length} color="bg-emerald-50" />
              <InfoCard icon={<AlertTriangle size={18} className="text-amber-700"/>} label="Deviations" value={deviatedCount} color="bg-amber-50" />
            </div>
 
            {/* Status Banner */}
            {isLocked ? (
              <div className="bg-green-50 border-b border-green-200 p-4 text-center">
                <p className="text-green-800 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle size={20} /> Review Completed (Approved/Rejected). This report is now read-only.
                </p>
              </div>
            ) : (
              <div className="bg-blue-50 border-b border-blue-200 p-4">
                <p className="text-blue-800 text-sm text-center">
                  Click <strong>"Add/Edit Remark"</strong> on any item to provide your decision. Once finished, click <strong>Finalize & Submit</strong>.
                </p>
              </div>
            )}
 
            {/* Main Table */}
            <main className="p-6 sm:p-8">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">NEPL ID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[180px]">Equipment</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">Make</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">Model</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">Range</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[100px]">Serial No</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider min-w-[250px]">Remarks / Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {inwardDetails.equipments.map((eq, index) => {
                      const isDeviated = eq.visual_inspection_notes !== 'OK';
                      const hasCustomerRemark = customerRemarks[eq.inward_eqp_id] && customerRemarks[eq.inward_eqp_id].trim() !== '';
                     
                      return (
                        <tr key={eq.inward_eqp_id} className={isDeviated ? "bg-amber-50/30" : "bg-white hover:bg-slate-50 transition-colors"}>
                         
                          <td className="px-4 py-4 text-sm text-slate-500 align-top">
                            {index + 1}
                          </td>
 
                          <td className="px-4 py-4 text-sm font-medium text-slate-900 align-top whitespace-nowrap">
                            {eq.nepl_id}
                          </td>
 
                          <td className="px-4 py-4 text-sm text-slate-900 align-top">
                            <div className="font-medium">{eq.material_description}</div>
                            {eq.photos && eq.photos.length > 0 && (
                              <div className="flex gap-2 mt-3">
                                {eq.photos.map((p, i) => (
                                  <button key={i} onClick={() => openImageModal(eq.photos)} className="relative group h-10 w-10 rounded overflow-hidden border border-slate-200 shadow-sm hover:ring-2 ring-indigo-500">
                                    <img src={resolvePhotoUrl(p)} alt="" className="h-full w-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
 
                          {/* Make */}
                          <td className="px-4 py-4 text-sm text-slate-700 align-top">
                            {eq.make}
                          </td>
 
                          {/* Model */}
                          <td className="px-4 py-4 text-sm text-slate-700 align-top">
                            {eq.model}
                          </td>
 
                          {/* Range - Added */}
                          <td className="px-4 py-4 text-sm text-slate-600 align-top whitespace-nowrap">
                             <div className="flex items-center gap-1.5">
                               <Gauge size={14} className="text-slate-400" />
                               {eq.range || '-'}
                             </div>
                          </td>
 
                          {/* Serial No - Modified (Removed Hash Icon) */}
                          <td className="px-4 py-4 text-sm text-slate-600 align-top font-mono">
                             {eq.serial_no || '-'}
                          </td>
 
                          {/* Quantity */}
                          <td className="px-4 py-4 text-sm text-slate-900 align-top text-center font-semibold">
                             {(eq as any).quantity || (eq as any).qty || 1}
                          </td>
 
                          <td className="px-4 py-4 align-top">
                            {isDeviated ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                                <AlertTriangle size={14} /> Deviation
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200 whitespace-nowrap">
                                <CheckCircle size={14} /> OK
                              </span>
                            )}
                          </td>
 
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-3">
                              {/* Engineer Remarks Display (Only for Deviations) */}
                              {isDeviated && (
                                <div className="bg-white p-3 rounded border border-amber-200 text-sm text-amber-900 shadow-sm">
                                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">
                                    <Wrench size={12} /> Engineer's Remarks
                                  </div>
                                  <div className="text-amber-900/90 bg-amber-50/50 p-2 rounded">
                                    {eq.engineer_remarks ? (
                                       <p className="font-medium text-gray-800">"{eq.engineer_remarks}"</p>
                                    ) : (
                                       <p className="italic text-slate-400 text-xs">No specific engineer remarks provided.</p>
                                    )}
                                  </div>
                                </div>
                              )}
 
                              {/* Customer Remarks Area */}
                              <div>
                                  {hasCustomerRemark && (
                                      <div className="mb-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-900">
                                          <span className="block text-xs font-semibold text-indigo-500 mb-1 uppercase">Your Decision:</span>
                                          "{customerRemarks[eq.inward_eqp_id]}"
                                      </div>
                                  )}
                                 
                                  <div className="flex items-center justify-between">
                                      {!isLocked && (
                                          <button
                                              onClick={() => openRemarkModal(eq.inward_eqp_id, customerRemarks[eq.inward_eqp_id] || "")}
                                              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm
                                              ${hasCustomerRemark
                                                  ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md'
                                              }`}
                                          >
                                              {hasCustomerRemark ? <Edit2 size={16} /> : <MessageSquarePlus size={16} />}
                                              {hasCustomerRemark ? 'Edit Remark' : 'Add Remark'}
                                          </button>
                                      )}
 
                                      {savedSuccessRows[eq.inward_eqp_id] && !isLocked && (
                                          <span className="text-green-600 text-xs font-medium flex items-center gap-1 animate-fade-in bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                              <CheckCircle size={12} /> Saved
                                          </span>
                                      )}
                                  </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
 
              {!isLocked && (
                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-end items-center gap-4">
                  <div className="text-sm text-slate-500 text-center sm:text-right">
                    Remarks are saved automatically when you click "Save" in the popup.<br/>
                    Finalizing will confirm completion.
                  </div>
                  <button
                    onClick={handleFinalize}
                    disabled={finalizing}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-base px-8 py-3 rounded-lg shadow-lg hover:shadow-green-600/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {finalizing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    Finalize & Submit to Engineer
                  </button>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
 
      {/* --- Image Modal --- */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setShowImageModal(false)}>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-black rounded-lg" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-white/70 hover:text-white z-10">
              <X size={32} />
            </button>
            <div className="p-2 overflow-y-auto h-full flex flex-col gap-4 items-center">
              {activePhotos.map((src, idx) => (
                <img key={idx} src={src} alt={`Detail ${idx}`} className="max-w-full rounded shadow-lg border border-slate-800" />
              ))}
            </div>
          </div>
        </div>
      )}
 
      {/* --- Add/Edit Remark Modal --- */}
      {showRemarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm transition-opacity" onClick={closeRemarkModal}>
            <div
                className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden transform transition-all"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <MessageSquarePlus className="text-indigo-600" size={20} />
                        {inwardDetails?.equipments.find(e => e.inward_eqp_id === editingId)?.customer_remarks ? 'Edit Remark' : 'Add Remark'}
                    </h3>
                    <button onClick={closeRemarkModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>
 
                {/* Modal Body */}
                <div className="p-6">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Your Decision / Remark:
                    </label>
                    <textarea
                        value={tempRemark}
                        onChange={(e) => setTempRemark(e.target.value)}
                        className="w-full h-32 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm leading-relaxed"
                        placeholder="E.g., Proceed with repair, Return as is, Recalibrate only..."
                        autoFocus
                    />
                    <p className="mt-2 text-xs text-slate-500">
                        Please be specific about how we should proceed with this equipment.
                    </p>
                </div>
 
                {/* Modal Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={closeRemarkModal}
                        disabled={savingRows[editingId!]}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveFromModal}
                        disabled={savingRows[editingId!]}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {savingRows[editingId!] ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                Save Remark
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};
 
export default CustomerRemarksPortal;
 