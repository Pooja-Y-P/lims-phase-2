import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { 
  ArrowLeft, Plus, Edit, Trash2, X, Save, 
  Loader2, AlertCircle, LineChart, Eye
} from 'lucide-react';
import { api } from '../../api/config'; // Adjust your import path if needed

// --- TYPES ---
export interface HTWTDistribution {
  id?: number;
  degrees_of_freedom: number;
  confidence_level: number;
  alpha: number;
  t_value: number;
  is_active: boolean;
  created_at?: string;
}

interface HTWTDistributionManagerProps {
  onBack: () => void;
}

// ============================================================================
// MAIN MANAGER COMPONENT
// ============================================================================
export const HTWTDistributionManager: React.FC<HTWTDistributionManagerProps> = ({ onBack }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');
  const [data, setData] = useState<HTWTDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE: Edit Modal & View Modal ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HTWTDistribution | null>(null);
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<HTWTDistribution | null>(null);

  // --- STATE: Delete Modal ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HTWTDistribution | null>(null);

  // --- STATE: Actions ---
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ---------------------------------------------------------
  // 1. ADD THIS USE EFFECT TO HANDLE SCROLL LOCKING
  // ---------------------------------------------------------
  useEffect(() => {
    // Check if any of the three modals are open
    if (isEditModalOpen || isViewModalOpen || isDeleteModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isEditModalOpen, isViewModalOpen, isDeleteModalOpen]);

  // --- API FETCH ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Ensure your backend endpoint matches. Using active_only=false to see all for admin.
      const response = await api.get('/admin/t-distribution', { params: { active_only: false } });
      
      const sorted = (response.data || []).sort((a: HTWTDistribution, b: HTWTDistribution) => 
        a.degrees_of_freedom - b.degrees_of_freedom
      );
      setData(sorted);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load T-Distribution table');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- HANDLERS ---

  // 1. Switch to Add Page
  const handleAddNewClick = () => {
    setViewMode('add');
  };

  // 2. Open Edit Modal
  const handleEditClick = (item: HTWTDistribution) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  // 3. Open View Modal
  const handleViewClick = (item: HTWTDistribution) => {
    setViewingItem(item);
    setIsViewModalOpen(true);
  };

  // 4. Delete Logic
  const handleDeleteClick = (item: HTWTDistribution) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete?.id) return;
    try {
      setDeletingId(itemToDelete.id);
      await api.delete(`/admin/t-distribution/${itemToDelete.id}`);
      setData(prev => prev.filter(item => item.id !== itemToDelete.id));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // 5. Unified Save Handler
  const handleSave = async (payload: HTWTDistribution, isEdit: boolean) => {
    setSubmitting(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/admin/t-distribution/${editingItem.id}`, payload);
        setIsEditModalOpen(false);
        setEditingItem(null);
      } else {
        await api.post('/admin/t-distribution', payload);
        setViewMode('list');
      }
      fetchData(); // Refresh list
    } catch (err: any) {
      throw err; // Let form handle error display
    } finally {
      setSubmitting(false);
    }
  };

  // Helper
  const renderDF = (val: number) => {
    return val >= 1000000 ? <span className="text-xl">∞</span> : val;
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  // --- RENDER ---

  if (viewMode === 'add') {
    return (
      <AddTDistPage 
        onCancel={() => setViewMode('list')}
        onSave={(payload) => handleSave(payload, false)}
        submitting={submitting}
      />
    );
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
             <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
               <LineChart className="text-blue-500" size={24}/> 
               Student T Distribution
             </h3>
             <p className="text-sm text-gray-500">Manage critical T-values for uncertainty calculations</p>
          </div>
        </div>
        <button 
          onClick={handleAddNewClick} 
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm transition-colors"
        >
            <Plus size={16} className="mr-2" /> Add Entry
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Data Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-gray-500">Loading table data...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Degrees of Freedom (v)</th>
                  <th className="px-6 py-4">Confidence Level (%)</th>
                  <th className="px-6 py-4">Alpha (α)</th>
                  <th className="px-6 py-4">Critical T-Value</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No records found.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-700">
                        {renderDF(item.degrees_of_freedom)}
                      </td>
                      <td className="px-6 py-4">{parseFloat(item.confidence_level.toString())}%</td>
                      <td className="px-6 py-4 text-gray-600">{parseFloat(item.alpha.toString()).toFixed(4)}</td>
                      <td className="px-6 py-4 font-bold text-blue-600">{parseFloat(item.t_value.toString()).toFixed(4)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleViewClick(item)} 
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={() => handleEditClick(item)} 
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteClick(item)} 
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
                              title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                         </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODAL (Popup) */}
      {isViewModalOpen && viewingItem && (
        // UPDATED Z-INDEX: z-[9999]
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-fadeIn overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <LineChart size={20} className="text-blue-500" />
                T-Distribution Details
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">DoF (v)</span>
                  <span className="text-lg font-mono font-bold text-gray-900">{renderDF(viewingItem.degrees_of_freedom)}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">T-Value</span>
                  <span className="text-lg font-mono font-bold text-blue-600">{viewingItem.t_value}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500">Confidence Level:</span>
                   <span className="text-gray-900 font-medium">{viewingItem.confidence_level}%</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500">Alpha (α):</span>
                   <span className="text-gray-900 font-medium">{viewingItem.alpha}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500">Status:</span>
                   <span className={`font-medium ${viewingItem.is_active ? 'text-green-600' : 'text-red-600'}`}>
                     {viewingItem.is_active ? 'Active' : 'Inactive'}
                   </span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500">Created At:</span>
                   <span className="text-gray-900">{formatDate(viewingItem.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL (Popup) */}
      {isEditModalOpen && editingItem && (
        <EditTDistModal 
          item={editingItem}
          onCancel={() => setIsEditModalOpen(false)}
          onSave={(payload) => handleSave(payload, true)}
          submitting={submitting}
        />
      )}

      {/* DELETE MODAL (Popup) */}
      {isDeleteModalOpen && itemToDelete && (
        // UPDATED Z-INDEX: z-[9999]
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Record</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to delete the record for <strong>DF: {renderDF(itemToDelete.degrees_of_freedom)}</strong>? 
                This will remove it from the T-Distribution table.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setItemToDelete(null);
                  }}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center"
                >
                  {deletingId !== null ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT 1: ADD PAGE (Full Page View)
// ============================================================================
interface AddPageProps {
  onCancel: () => void;
  onSave: (payload: HTWTDistribution) => Promise<void>;
  submitting: boolean;
}

const AddTDistPage: React.FC<AddPageProps> = ({ onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    degrees_of_freedom: '',
    confidence_level: '',
    alpha: '',
    t_value: '',
    is_active: true
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    const payload = {
      degrees_of_freedom: parseInt(formData.degrees_of_freedom),
      confidence_level: parseFloat(formData.confidence_level),
      alpha: parseFloat(formData.alpha),
      t_value: parseFloat(formData.t_value),
      is_active: formData.is_active
    };

    if (isNaN(payload.degrees_of_freedom) || isNaN(payload.confidence_level) || isNaN(payload.alpha) || isNaN(payload.t_value)) {
      setError("Please ensure all numeric fields are valid.");
      return;
    }

    try {
      await onSave(payload);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save record.");
    }
  };

  return (
    <div className="max-w-xl mx-auto animate-fadeIn">
      <div className="mb-6">
        <button 
          onClick={onCancel} 
          className="flex items-center text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm"
        >
          <ArrowLeft size={16} className="mr-2" /> Back to List
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <Plus className="w-5 h-5 text-blue-500 mr-2" />
            Add T-Distribution Value
          </h3>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center">
            <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Degrees of Freedom</label>
            <input
              type="number"
              name="degrees_of_freedom"
              value={formData.degrees_of_freedom}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
              placeholder="e.g. 10 (Use 1000000 for ∞)"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Use a large value (e.g. 1000000) to represent Infinity.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confidence (%)</label>
              <input
                type="number"
                step="0.01"
                name="confidence_level"
                value={formData.confidence_level}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                placeholder="e.g. 95.0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alpha (α)</label>
              <input
                type="number"
                step="0.0001"
                name="alpha"
                value={formData.alpha}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                placeholder="e.g. 0.05"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Critical T-Value</label>
            <input
              type="number"
              step="0.0001"
              name="t_value"
              value={formData.t_value}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              placeholder="e.g. 2.2281"
              required
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between mt-2">
             <span className="text-sm font-medium text-gray-700">Record Status</span>
             <label className="relative inline-flex items-center cursor-pointer">
               <input 
                  type="checkbox" 
                  name="is_active"
                  checked={formData.is_active} 
                  onChange={handleChange} 
                  className="sr-only peer" 
                />
               <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               <span className="ml-3 text-sm font-medium text-gray-600 w-16">{formData.is_active ? 'Active' : 'Inactive'}</span>
             </label>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT 2: EDIT MODAL (Popup Overlay)
// ============================================================================
interface EditModalProps {
  item: HTWTDistribution;
  onCancel: () => void;
  onSave: (payload: HTWTDistribution) => Promise<void>;
  submitting: boolean;
}

const EditTDistModal: React.FC<EditModalProps> = ({ item, onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    degrees_of_freedom: item.degrees_of_freedom.toString(),
    confidence_level: item.confidence_level.toString(),
    alpha: item.alpha.toString(),
    t_value: item.t_value.toString(),
    is_active: item.is_active
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      degrees_of_freedom: parseInt(formData.degrees_of_freedom),
      confidence_level: parseFloat(formData.confidence_level),
      alpha: parseFloat(formData.alpha),
      t_value: parseFloat(formData.t_value),
      is_active: formData.is_active
    };

    if (isNaN(payload.degrees_of_freedom) || isNaN(payload.confidence_level) || isNaN(payload.alpha) || isNaN(payload.t_value)) {
      setError("Please ensure all numeric fields are valid.");
      return;
    }

    try {
      await onSave(payload);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update record.");
    }
  };

  return (
    // UPDATED Z-INDEX: z-[9999]
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fadeIn overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <LineChart className="text-blue-500" size={20} />
            Edit T-Value
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Degrees of Freedom</label>
            <input
              type="number"
              name="degrees_of_freedom"
              value={formData.degrees_of_freedom}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Use a large value (e.g. 1000000) for ∞.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confidence (%)</label>
              <input
                type="number"
                step="0.01"
                name="confidence_level"
                value={formData.confidence_level}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alpha (α)</label>
              <input
                type="number"
                step="0.0001"
                name="alpha"
                value={formData.alpha}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Critical T-Value</label>
            <input
              type="number"
              step="0.0001"
              name="t_value"
              value={formData.t_value}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              required
            />
          </div>

          <div className="flex items-center h-full pt-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                name="is_active" 
                checked={formData.is_active} 
                onChange={handleChange} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Active' : 'Inactive'}</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};