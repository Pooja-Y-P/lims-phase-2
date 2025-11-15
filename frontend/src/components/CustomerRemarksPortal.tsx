import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, BACKEND_ROOT_URL } from '../api/config';
import { Save, ArrowLeft, CheckCircle, AlertTriangle, FileText, Calendar, Package, ChevronRight, Building, MessageSquare, X,Camera } from 'lucide-react';

// --- Interfaces are unchanged ---
interface EquipmentForRemarks {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  visual_inspection_notes: string | null;
  remarks_and_decision: string | null;
  photos?: string[];
}

interface InwardForRemarks {
  inward_id: number;
  srf_no: number;
  date: string;
  status: string;
  equipments: EquipmentForRemarks[];
}

interface Props {
  directAccess?: boolean;
  accessToken?: string;
}

// Sub-components
const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-white p-4 rounded-lg border flex items-center gap-4">
    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  </div>
);

export const CustomerRemarksPortal: React.FC<Props> = ({ directAccess = false, accessToken }) => {
  // --- All state and logic functions are unchanged ---
  const { inwardId } = useParams<{ inwardId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || accessToken;

  const [inwardDetails, setInwardDetails] = useState<InwardForRemarks | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerRemarks, setCustomerRemarks] = useState<{ [key: number]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [activePhotos, setActivePhotos] = useState<string[]>([]);

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
        if (eq.visual_inspection_notes !== 'OK') {
          initialRemarks[eq.inward_eqp_id] = eq.remarks_and_decision || '';
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

  const sanitizePhotoPath = (path: string) => {
    if (!path) return '';
    const sanitized = path.replace(/\\/g, '/');
    if (/^https?:\/\//i.test(sanitized)) {
      return sanitized;
    }
    const trimmed = sanitized.replace(/^\/+/, '');
    return trimmed ? `/${trimmed}` : '';
  };

  const resolvePhotoUrl = (path: string) => {
    const normalized = sanitizePhotoPath(path);
    if (!normalized) return '';
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return `${BACKEND_ROOT_URL}${normalized}`;
  };

  const openImageModal = (photos?: string[]) => {
    if (!photos || photos.length === 0) {
      return;
    }
    const resolved = photos
      .map(resolvePhotoUrl)
      .filter((url): url is string => Boolean(url));
    if (resolved.length === 0) {
      return;
    }
    setActivePhotos(resolved);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setActivePhotos([]);
    setShowImageModal(false);
  };

  useEffect(() => {
    fetchInwardDetails();
  }, [fetchInwardDetails]);

  const handleRemarksChange = (equipmentId: number, value: string) => {
    setCustomerRemarks(prev => ({ ...prev, [equipmentId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const remarksArray = Object.entries(customerRemarks)
        .filter(([, remark]) => remark.trim() !== '')
        .map(([equipmentId, remark]) => ({
          inward_eqp_id: parseInt(equipmentId),
          remarks_and_decision: remark
        }));

      const url = token ? `/portal/direct-fir/${inwardId}/remarks?token=${token}` : `/portal/firs/${inwardId}/remarks`;
      await api.post(url, { remarks: remarksArray });

      alert('Remarks submitted successfully! Our engineering team will review your feedback and proceed with the next steps.');
      if (!directAccess && !token) {
        navigate('/customer');
      } else {
        setInwardDetails(prev => prev ? { ...prev, status: 'customer_reviewed' } : null);
      }
    } catch (error: any) {
      console.error('Error submitting remarks:', error);
      alert(error.response?.data?.detail || 'Failed to submit remarks. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackNavigation = () => {
    if (directAccess || token) {
      alert('Thank you. You may now close this page.');
    } else {
      navigate('/customer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading First Inspection Report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-5" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={handleBackNavigation}
              className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              {directAccess || token ? 'Close Page' : 'Back to Dashboard'}
            </button>
        </div>
      </div>
    );
  }

  if (!inwardDetails) return null;

  const isAlreadyReviewed = inwardDetails.status === 'customer_reviewed';
  const deviatedEquipment = inwardDetails.equipments.filter(eq => eq.visual_inspection_notes !== 'OK');
  const nonDeviatedEquipment = inwardDetails.equipments.filter(eq => eq.visual_inspection_notes === 'OK');

  return (
    <>
      <div className="min-h-screen bg-slate-100 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
            
          <header className="bg-slate-800 px-6 py-5 sm:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-slate-700 p-2 rounded-lg">
                  <Building className="h-7 w-7 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">First Inspection Report</h1>
                  <p className="text-sm text-slate-300">Official review document for your equipment.</p>
                </div>
              </div>
              {!directAccess && !token && (
                <button
                  onClick={handleBackNavigation}
                  className="hidden sm:flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <ArrowLeft size={18} />
                  <span>Back to Dashboard</span>
                </button>
              )}
            </div>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-200">
            <InfoCard icon={<FileText size={20} className="text-indigo-800" />} label="SRF Number" value={inwardDetails.srf_no} color="bg-indigo-100" />
            <InfoCard icon={<Calendar size={20} className="text-sky-800" />} label="Report Date" value={new Date(inwardDetails.date).toLocaleDateString()} color="bg-sky-100" />
            <InfoCard icon={<Package size={20} className="text-slate-800" />} label="Total Items" value={inwardDetails.equipments.length} color="bg-slate-200" />
            <InfoCard icon={<AlertTriangle size={20} className="text-orange-800" />} label="Items with Deviations" value={deviatedEquipment.length} color="bg-orange-100" />
          </section>

          <main className="p-6 sm:p-8">
            <form onSubmit={handleSubmit}>
              {/* Status Banner */}
              {isAlreadyReviewed ? (
                <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded-r-lg mb-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6" />
                    <div>
                      <h3 className="font-bold">Review Complete</h3>
                      <p className="text-sm">Thank you for your feedback. No further action is required on this page.</p>
                    </div>
                  </div>
                </div>
              ) : deviatedEquipment.length > 0 ? (
                 <div className="bg-orange-50 border-l-4 border-orange-500 text-orange-800 p-4 rounded-r-lg mb-8">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-6 w-6" />
                    <div>
                      <h3 className="font-bold">Action Required</h3>
                      <p className="text-sm">Please review the items with deviations below and provide your remarks.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border-l-4 border-green-500 text-green-800 p-4 rounded-r-lg mb-8">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6" />
                        <div>
                            <h3 className="font-bold">No Deviations Found</h3>
                            <p className="text-sm">All equipment passed visual inspection. No action is required from you.</p>
                        </div>
                    </div>
                </div>
              )}
              
              <div className="space-y-8">

                {/* === MODIFIED SECTION: Row View for "Action Required" Equipment === */}
                {deviatedEquipment.length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-4">Items Requiring Your Attention</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th scope="col" className="w-2/5 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                              <th scope="col" className="w-1/5 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">NEPL ID</th>
                              <th scope="col" className="w-1/5 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Make / Model</th>
                              <th scope="col" className="w-1/5 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                              <th scope="col" className="w-1/5 px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Images</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {deviatedEquipment.map((equipment) => (
                              <React.Fragment key={equipment.inward_eqp_id}>
                                <tr>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 border-l-4 border-orange-500">{equipment.material_description}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{equipment.nepl_id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 hidden sm:table-cell">{equipment.make} / {equipment.model}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      <AlertTriangle size={14} />
                                      Deviation Noted
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {equipment.photos && equipment.photos.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => openImageModal(equipment.photos)}
                                        className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 transition-colors text-xs font-semibold"
                                      >
                                        <Camera size={16} />
                                        View Images ({equipment.photos.length})
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 text-xs">Not Available</span>
                                    )}
                                  </td>
                                </tr>
                                <tr className="bg-slate-50/50">
                                  <td colSpan={5} className="p-4 sm:p-6 border-l-4 border-orange-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                        <h4 className="font-semibold text-amber-900 text-sm flex items-center gap-2">
                                          <MessageSquare size={16} /> Engineer's Note
                                        </h4>
                                        <p className="text-amber-800 text-sm mt-2">{equipment.visual_inspection_notes}</p>
                                      </div>
                                      <div>
                                        <label htmlFor={`remarks-${equipment.inward_eqp_id}`} className="block text-sm font-medium text-slate-700 mb-1.5">
                                          Your Remarks / Decision <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                          id={`remarks-${equipment.inward_eqp_id}`}
                                          value={customerRemarks[equipment.inward_eqp_id] || ''}
                                          onChange={(e) => handleRemarksChange(equipment.inward_eqp_id, e.target.value)}
                                          placeholder="e.g., 'Proceed with calibration.' or 'Return this item.'"
                                          rows={3}
                                          disabled={isAlreadyReviewed}
                                          className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                          required
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                {/* === END OF MODIFIED SECTION === */}

                {nonDeviatedEquipment.length > 0 && (
                  <details className="group" open>
                    <summary className="list-none flex items-center justify-between cursor-pointer p-4 bg-slate-50 hover:bg-slate-100 rounded-lg">
                      <h4 className="text-lg font-semibold text-slate-700">Items Without Deviations ({nonDeviatedEquipment.length})</h4>
                      <ChevronRight className="h-5 w-5 text-slate-500 transition-transform duration-200 group-open:rotate-90" />
                    </summary>
                    <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">NEPL ID</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Make / Model</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Images</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {nonDeviatedEquipment.map((equipment) => (
                              <tr key={equipment.inward_eqp_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{equipment.material_description}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{equipment.nepl_id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 hidden sm:table-cell">{equipment.make} / {equipment.model}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle size={14} />
                                    No Issues
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  {equipment.photos && equipment.photos.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {equipment.photos.map((photo, idx) => {
                                        const resolved = resolvePhotoUrl(photo);
                                        if (!resolved) return null;
                                        return (
                                          <button
                                            key={`${photo}-${idx}`}
                                            type="button"
                                            className="h-14 w-14 overflow-hidden rounded border border-slate-200 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            onClick={() => openImageModal(equipment.photos)}
                                            title="Click to view full image"
                                          >
                                            <img
                                              src={resolved}
                                              alt={`Equipment image ${idx + 1}`}
                                              className="h-full w-full object-cover"
                                            />
                                            <span className="sr-only">View image {idx + 1}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-xs">Not Available</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                )}
              </div>

              <div className="mt-10 pt-6 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-lg px-8 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Save size={22} />
                  <span>{saving ? 'Submitting...' : 'Submit Final Review'}</span>
                </button>
              </div>

            </form>
          </main>
        </div>
      </div>
    </div>

      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Equipment Images</h3>
              <button
                type="button"
                onClick={closeImageModal}
                className="text-slate-500 hover:text-slate-700 transition-colors"
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {activePhotos.map((photo, index) => (
                <img
                  key={`${photo}-${index}`}
                  src={photo}
                  alt={`Equipment attachment ${index + 1}`}
                  className="w-full rounded-lg shadow-sm"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
);
};

export default CustomerRemarksPortal;