import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/config';
import { Save, ArrowLeft, User, Calendar } from 'lucide-react';

interface Equipment {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  remarks: string;
}

interface InwardDetails {
  inward_id: number;
  srf_no: number;
  date: string;
  status: string;
  equipments: Equipment[];
}

export const CustomerRemarksPortal: React.FC = () => {
  const { inwardId } = useParams<{ inwardId: string }>();
  const navigate = useNavigate();

  const [inwardDetails, setInwardDetails] = useState<InwardDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    fetchInwardDetails();
  }, [inwardId]);

  const fetchInwardDetails = async () => {
    try {
      // Fix: Add a generic type to the api.get call to correctly type the response data.
      const response = await api.get<InwardDetails>(`/portal/inwards/${inwardId}`);
      const data = response.data;
      setInwardDetails(data);
      
      // Initialize remarks from existing data
      const initialRemarks: { [key: number]: string } = {};
      // Fix: 'data' is now correctly typed as InwardDetails, so data.equipments is accessible.
      data.equipments.forEach((eq: Equipment) => {
        initialRemarks[eq.inward_eqp_id] = eq.remarks || '';
      });
      setRemarks(initialRemarks);
      
    } catch (error: any) {
      console.error('Error fetching inward details:', error);
      alert('Failed to load inward details');
      navigate('/customer');
    } finally {
      setLoading(false);
    }
  };

  const handleRemarksChange = (equipmentId: number, value: string) => {
    setRemarks(prev => ({
      ...prev,
      [equipmentId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const remarksArray = Object.entries(remarks).map(([equipmentId, remark]) => ({
        inward_eqp_id: parseInt(equipmentId),
        remarks: remark
      }));

      await api.post(`/portal/inwards/${inwardId}/remarks`, {
        remarks: remarksArray
      });

      alert('Remarks submitted successfully! Status updated to reviewed.');
      navigate('/customer');
      
    } catch (error: any) {
      console.error('Error submitting remarks:', error);
      alert(error.response?.data?.detail || 'Failed to submit remarks');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inward details...</p>
        </div>
      </div>
    );
  }

  if (!inwardDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Failed to load inward details.</p>
          <button
            onClick={() => navigate('/customer')}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
          >
            Back to Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <User className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">Add Equipment Remarks</h1>
                  <p className="text-blue-100">SRF {inwardDetails.srf_no} - First Inspection Review</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/customer')}
                className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Back to Portal</span>
              </button>
            </div>
          </div>

          {/* Inward Info */}
          <div className="bg-gray-50 border-b px-6 py-4">
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>Date: {new Date(inwardDetails.date).toLocaleDateString()}</span>
              </div>
              <span>•</span>
              <span>Status: {inwardDetails.status}</span>
              <span>•</span>
              <span>{inwardDetails.equipments.length} Equipment(s)</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Equipment First Inspection Review</h2>
              <p className="text-gray-600 mb-6">
                Please review each equipment item and add your remarks. Your feedback will help us provide better calibration services.
              </p>
            </div>

            <div className="space-y-6">
              {inwardDetails.equipments.map((equipment, index) => (
                <div key={equipment.inward_eqp_id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-700 mb-2">
                        Equipment #{index + 1}: {equipment.nepl_id}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium text-gray-700">Description:</span> {equipment.material_description}</p>
                        <p><span className="font-medium text-gray-700">Make:</span> {equipment.make}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium text-gray-700">Model:</span> {equipment.model}</p>
                      <p><span className="font-medium text-gray-700">Serial No:</span> {equipment.serial_no || 'N/A'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Remarks / Comments:
                    </label>
                    <textarea
                      value={remarks[equipment.inward_eqp_id] || ''}
                      onChange={(e) => handleRemarksChange(equipment.inward_eqp_id, e.target.value)}
                      placeholder="Please add your remarks about this equipment's condition, any special instructions, or observations..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg transition-colors shadow-md"
              >
                <Save size={20} />
                <span>{saving ? 'Submitting...' : 'Submit Remarks'}</span>
              </button>
            </div>

            <div className="mt-4 text-center text-sm text-gray-600">
              <p>After submitting your remarks, the status will be updated to "Reviewed" and our engineers will proceed with the SRF creation.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};