import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ENDPOINTS } from '../api/config';
import { ArrowLeft, Save, FileText } from 'lucide-react';

interface Equipment {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  serial_no: string;
  quantity: number;
  calibration_by: string;
  remarks: string;
}

interface ReviewedInward {
  inward_id: number;
  srf_no: string;
  date: string;
  customer_details: string;
  equipments: Equipment[];
}

// Define the shape of the POST response
interface SrfCreationResponse {
  srf_id: number;
}


export const SrfFormCreator: React.FC = () => {
  const { inwardId } = useParams<{ inwardId: string }>();
  const navigate = useNavigate();

  const [inwardData, setInwardData] = useState<ReviewedInward | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [srfData, setSrfData] = useState({
    telephone: '',
    contact_person: '',
    email: '',
    certificate_issue_name: '',
    calibration_frequency: '',
    statement_of_conformity: false,
    ref_iso_is_doc: false,
    ref_manufacturer_manual: false,
    ref_customer_requirement: false,
    turnaround_time: 7,
    remark_special_instructions: '',
    equipment_details: {} as { [key: string]: { unit: string; calibration_points: number; calibration_mode: string } }
  });

  useEffect(() => {
    fetchInwardData();
  }, [inwardId]);

  const fetchInwardData = async () => {
    try {
      // FIX 1: Add a generic type to api.get to specify the expected response type.
      const response = await api.get<ReviewedInward[]>(`${ENDPOINTS.SRFS}reviewed-inwards`);
      const reviewedInward = response.data.find((inward: ReviewedInward) => 
        inward.inward_id === parseInt(inwardId!)
      );
      
      if (!reviewedInward) {
        throw new Error('Inward not found or not reviewed');
      }

      setInwardData(reviewedInward);
      
      // Initialize equipment details
      const equipmentDetails: { [key: string]: { unit: string; calibration_points: number; calibration_mode: string } } = {};
      // FIX 2: Explicitly type the 'eq' parameter.
      reviewedInward.equipments.forEach((eq: Equipment) => {
        equipmentDetails[eq.inward_eqp_id.toString()] = {
          unit: '',
          calibration_points: 1,
          calibration_mode: 'As Found'
        };
      });
      
      setSrfData(prev => ({
        ...prev,
        equipment_details: equipmentDetails
      }));
      
    } catch (error) {
      console.error('Error fetching inward data:', error);
      alert('Error loading inward data');
      navigate('/engineer/srfs');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setSrfData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEquipmentChange = (equipmentId: string, field: string, value: any) => {
    setSrfData(prev => ({
      ...prev,
      equipment_details: {
        ...prev.equipment_details,
        [equipmentId]: {
          ...prev.equipment_details[equipmentId],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // FIX 3: Add a generic type to api.post for the expected response.
      const response = await api.post<SrfCreationResponse>(
        `${ENDPOINTS.SRFS}create-from-inward/${inwardId}`,
        srfData
      );
      
      alert(`SRF created successfully! SRF ID: ${response.data.srf_id}`);
      navigate('/engineer/srfs');
    } catch (error: any) {
      console.error('Error creating SRF:', error);
      alert(error.response?.data?.detail || 'Failed to create SRF');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!inwardData) {
    return (
      <div className="text-center text-red-600 p-8">
        <p>Inward data not found or not ready for SRF creation.</p>
        <button
          onClick={() => navigate('/engineer/srfs')}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Back to SRF Management
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div className="flex items-center space-x-4">
          <FileText className="h-8 w-8 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create SRF Form</h1>
            <p className="text-gray-600">SRF {inwardData.srf_no} - {inwardData.customer_details}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/engineer/srfs')}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to SRF Management</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Customer Information */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Customer Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
              <input
                type="text"
                value={srfData.contact_person}
                onChange={(e) => handleInputChange('contact_person', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact person name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Telephone</label>
              <input
                type="text"
                value={srfData.telephone}
                onChange={(e) => handleInputChange('telephone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={srfData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Certificate Issue Name</label>
              <input
                type="text"
                value={srfData.certificate_issue_name}
                onChange={(e) => handleInputChange('certificate_issue_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter certificate issue name"
              />
            </div>
          </div>
        </div>

        {/* Calibration Details */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Calibration Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Calibration Frequency</label>
              <select
                value={srfData.calibration_frequency}
                onChange={(e) => handleInputChange('calibration_frequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select frequency</option>
                <option value="6 months">6 Months</option>
                <option value="1 year">1 Year</option>
                <option value="2 years">2 Years</option>
                <option value="As per customer requirement">As per customer requirement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Turnaround Time (Days)</label>
              <input
                type="number"
                min="1"
                value={srfData.turnaround_time}
                onChange={(e) => handleInputChange('turnaround_time', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Reference Documents</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={srfData.statement_of_conformity}
                  onChange={(e) => handleInputChange('statement_of_conformity', e.target.checked)}
                  className="mr-2"
                />
                Statement of Conformity
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={srfData.ref_iso_is_doc}
                  onChange={(e) => handleInputChange('ref_iso_is_doc', e.target.checked)}
                  className="mr-2"
                />
                ISO/IS Documents
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={srfData.ref_manufacturer_manual}
                  onChange={(e) => handleInputChange('ref_manufacturer_manual', e.target.checked)}
                  className="mr-2"
                />
                Manufacturer's Manual
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={srfData.ref_customer_requirement}
                  onChange={(e) => handleInputChange('ref_customer_requirement', e.target.checked)}
                  className="mr-2"
                />
                Customer Requirement
              </label>
            </div>
          </div>
        </div>

        {/* Equipment Details */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Equipment Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 p-3 text-left">NEPL ID</th>
                  <th className="border border-gray-300 p-3 text-left">Description</th>
                  <th className="border border-gray-300 p-3 text-left">Make/Model</th>
                  <th className="border border-gray-300 p-3 text-left">Unit</th>
                  <th className="border border-gray-300 p-3 text-left">Calibration Points</th>
                  <th className="border border-gray-300 p-3 text-left">Calibration Mode</th>
                  <th className="border border-gray-300 p-3 text-left">Customer Remarks</th>
                </tr>
              </thead>
              <tbody>
                {inwardData.equipments.map((equipment) => (
                  <tr key={equipment.inward_eqp_id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 p-3 font-mono font-bold text-blue-600">
                      {equipment.nepl_id}
                    </td>
                    <td className="border border-gray-300 p-3">
                      {equipment.material_description}
                    </td>
                    <td className="border border-gray-300 p-3">
                      {equipment.make} / {equipment.model}
                    </td>
                    <td className="border border-gray-300 p-3">
                      <input
                        type="text"
                        value={srfData.equipment_details[equipment.inward_eqp_id]?.unit || ''}
                        onChange={(e) => handleEquipmentChange(equipment.inward_eqp_id.toString(), 'unit', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Unit"
                      />
                    </td>
                    <td className="border border-gray-300 p-3">
                      <input
                        type="number"
                        min="1"
                        value={srfData.equipment_details[equipment.inward_eqp_id]?.calibration_points || 1}
                        onChange={(e) => handleEquipmentChange(equipment.inward_eqp_id.toString(), 'calibration_points', parseInt(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      />
                    </td>
                    <td className="border border-gray-300 p-3">
                      <select
                        value={srfData.equipment_details[equipment.inward_eqp_id]?.calibration_mode || 'As Found'}
                        onChange={(e) => handleEquipmentChange(equipment.inward_eqp_id.toString(), 'calibration_mode', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                      >
                        <option value="As Found">As Found</option>
                        <option value="As Left">As Left</option>
                        <option value="As Found & As Left">As Found & As Left</option>
                      </select>
                    </td>
                    <td className="border border-gray-300 p-3 bg-blue-50">
                      <div className="text-sm text-gray-700 max-w-xs">
                        {equipment.remarks || 'No remarks'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Special Instructions */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Special Instructions</h2>
          <textarea
            value={srfData.remark_special_instructions}
            onChange={(e) => handleInputChange('remark_special_instructions', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter any special instructions for calibration..."
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-6 border-t">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold px-8 py-3 rounded-lg transition-colors"
          >
            <Save size={20} />
            <span>{saving ? 'Creating SRF...' : 'Create SRF'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};