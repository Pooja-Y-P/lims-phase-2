import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/config';
import { Save, ArrowLeft, User, Calendar, AlertTriangle } from 'lucide-react';

// --- UPDATED Interfaces to match the backend workflow ---
interface EquipmentForRemarks {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  visual_inspection_notes: string | null; // Engineer's notes
  remarks_and_decision: string | null;      // Customer's feedback
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

export const CustomerRemarksPortal: React.FC<Props> = ({ directAccess = false, accessToken }) => {
  const { inwardId } = useParams<{ inwardId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || accessToken;

  const [inwardDetails, setInwardDetails] = useState<InwardForRemarks | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customerRemarks, setCustomerRemarks] = useState<{ [key: number]: string }>({});
  const [error, setError] = useState<string | null>(null);

  const fetchInwardDetails = useCallback(async () => {
    if (!inwardId) return;
    try {
      setLoading(true);
      setError(null);

      let response;
      if (directAccess || token) {
        // Direct access via email link
        const url = token ? 
          `/portal/direct-fir/${inwardId}?token=${token}` : 
          `/portal/direct-fir/${inwardId}`;
        response = await api.get<InwardForRemarks>(url);
      } else {
        // Authenticated customer access
        response = await api.get<InwardForRemarks>(`/portal/firs/${inwardId}`);
      }

      const data = response.data;
      setInwardDetails(data);
      
      // Initialize remarks state only for deviated items
      const initialRemarks: { [key: number]: string } = {};
      data.equipments.forEach((eq) => {
        if (eq.visual_inspection_notes !== 'OK') {
          initialRemarks[eq.inward_eqp_id] = eq.remarks_and_decision || '';
        }
      });
      setCustomerRemarks(initialRemarks);
      
    } catch (error: any) {
      console.error('Error fetching FIR details:', error);
      if (error.response?.status === 400 && error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('Failed to load First Inspection Report details.');
      }
      
      if (!directAccess && !token) {
        navigate('/customer');
      }
    } finally {
      setLoading(false);
    }
  }, [inwardId, navigate, directAccess, token]);

  useEffect(() => {
    fetchInwardDetails();
  }, [fetchInwardDetails]);

  const handleRemarksChange = (equipmentId: number, value: string) => {
    setCustomerRemarks(prev => ({
      ...prev,
      [equipmentId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Construct the payload with remarks only for deviated equipment
      const remarksArray = Object.entries(customerRemarks)
        .filter(([, remark]) => remark.trim() !== '') // Only submit non-empty remarks
        .map(([equipmentId, remark]) => ({
          inward_eqp_id: parseInt(equipmentId),
          remarks_and_decision: remark
        }));

      let response;
      if (directAccess || token) {
        // Direct access submission
        const url = token ? 
          `/portal/direct-fir/${inwardId}/remarks?token=${token}` : 
          `/portal/direct-fir/${inwardId}/remarks`;
        response = await api.post(url, { remarks: remarksArray });
      } else {
        // Authenticated submission
        response = await api.post(`/portal/firs/${inwardId}/remarks`, {
          remarks: remarksArray
        });
      }

      alert('Remarks submitted successfully! Our engineering team will review your feedback and proceed with the next steps.');
      
      if (!directAccess && !token) {
        navigate('/customer');
      } else {
        // For direct access, show success message and disable form
        setInwardDetails(prev => prev ? { ...prev, status: 'customer_reviewed' } : null);
      }
      
    } catch (error: any) {
      console.error('Error submitting remarks:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to submit remarks. Please try again.';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleBackNavigation = () => {
    if (directAccess || token) {
      // For direct access, show a simple message
      alert('Thank you for visiting. You can close this page.');
    } else {
      navigate('/customer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading First Inspection Report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-800 mb-2">Access Error</h2>
            <p className="text-red-700">{error}</p>
            <button
              onClick={handleBackNavigation}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
            >
              {directAccess || token ? 'Close' : 'Back to Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!inwardDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-red-600 font-semibold text-lg">Failed to load report details.</p>
          <button
            onClick={handleBackNavigation}
            className="mt-4 bg-indigo-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-indigo-700"
          >
            {directAccess || token ? 'Close' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  // Check if customer has already reviewed
  const isAlreadyReviewed = inwardDetails.status === 'customer_reviewed';
  
  // Get deviated equipment count
  const deviatedEquipment = inwardDetails.equipments.filter(eq => eq.visual_inspection_notes !== 'OK');
  const nonDeviatedEquipment = inwardDetails.equipments.filter(eq => eq.visual_inspection_notes === 'OK');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <User className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">First Inspection Report (FIR)</h1>
                  <p className="text-indigo-100">For SRF {inwardDetails.srf_no}</p>
                </div>
              </div>
              {!directAccess && !token && (
                <button
                  onClick={handleBackNavigation}
                  className="flex items-center space-x-2 bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <ArrowLeft size={20} />
                  <span>Back</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Banner */}
          {isAlreadyReviewed && (
            <div className="bg-green-50 border-b border-green-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-green-800">Review Complete</h3>
                  <p className="text-sm text-green-700">Thank you for your feedback. Our engineering team will proceed with the next steps.</p>
                </div>
              </div>
            </div>
          )}

          {/* Inward Info */}
          <div className="bg-gray-50 border-b px-6 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>Date: {new Date(inwardDetails.date).toLocaleDateString()}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Status:</span>
                <span className={`capitalize px-2 py-0.5 rounded-full font-medium text-xs ${
                  isAlreadyReviewed 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-orange-100 text-orange-800'
                }`}>
                  {inwardDetails.status.replace(/_/g, " ")}
                </span>
              </div>
              <span>•</span>
              <span>{inwardDetails.equipments.length} Equipment Item(s)</span>
              {deviatedEquipment.length > 0 && (
                <>
                  <span>•</span>
                  <span className="text-orange-600 font-medium">
                    {deviatedEquipment.length} Item(s) require attention
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Equipment Inspection Review</h2>
              <p className="text-gray-600">
                Items with deviations are listed first and require your feedback. Items without deviations are shown below for reference.
              </p>
            </div>

            <div className="space-y-6">
              {/* Deviated Equipment First */}
              {deviatedEquipment.map((equipment, index) => (
                <div key={equipment.inward_eqp_id} className="border-2 border-orange-300 bg-orange-50/50 rounded-xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Equipment Details Column */}
                    <div>
                      <h3 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        #{index + 1}: {equipment.material_description}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium text-gray-500 w-20 inline-block">NEPL ID:</span> {equipment.nepl_id}</p>
                        <p><span className="font-medium text-gray-500 w-20 inline-block">Make:</span> {equipment.make}</p>
                        <p><span className="font-medium text-gray-500 w-20 inline-block">Model:</span> {equipment.model}</p>
                        <p><span className="font-medium text-gray-500 w-20 inline-block">Serial No:</span> {equipment.serial_no || 'N/A'}</p>
                      </div>
                    </div>
                    
                    {/* Deviation & Remarks Column */}
                    <div className="space-y-4">
                      <div className="p-4 bg-orange-100 border border-orange-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="font-semibold text-orange-900">Deviation Noted by Engineer</h4>
                            <p className="text-sm text-orange-800 mt-1">{equipment.visual_inspection_notes}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label htmlFor={`remarks-${equipment.inward_eqp_id}`} className="block text-sm font-medium text-gray-800 mb-1">
                          Your Remarks / Decision: <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          id={`remarks-${equipment.inward_eqp_id}`}
                          value={customerRemarks[equipment.inward_eqp_id] || ''}
                          onChange={(e) => handleRemarksChange(equipment.inward_eqp_id, e.target.value)}
                          placeholder="e.g., 'Sending missing part via courier', 'Equipment was not damaged during transport, please return for recalibration', etc."
                          rows={3}
                          disabled={isAlreadyReviewed}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Non-deviated Equipment (Reference Only) */}
              {nonDeviatedEquipment.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Equipment Without Deviations (Reference Only)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {nonDeviatedEquipment.map((equipment) => (
                      <div key={equipment.inward_eqp_id} className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-800 mb-2">{equipment.material_description}</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><span className="font-medium">NEPL ID:</span> {equipment.nepl_id}</p>
                          <p><span className="font-medium">Make/Model:</span> {equipment.make} / {equipment.model}</p>
                          <p><span className="font-medium">Status:</span> <span className="text-green-600 font-medium">No Issues</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            {!isAlreadyReviewed && deviatedEquipment.length > 0 && (
              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg transition-colors shadow-md"
                >
                  <Save size={20} />
                  <span>{saving ? 'Submitting...' : 'Submit Review'}</span>
                </button>
              </div>
            )}

            <div className="mt-4 text-center text-sm text-gray-600">
              {isAlreadyReviewed ? (
                <p>Your feedback has been submitted and is being processed by our engineering team.</p>
              ) : deviatedEquipment.length === 0 ? (
                <p>All equipment items passed inspection without any deviations. No customer action required.</p>
              ) : (
                <p>After submitting, our engineers will be notified to proceed with the next steps based on your feedback.</p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerRemarksPortal;