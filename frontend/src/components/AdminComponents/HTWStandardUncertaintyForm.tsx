import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/config'; // Adjust path
import { 
  ArrowLeft, Plus, Edit, Trash2, X, Save, 
  Loader2, AlertCircle, CheckCircle, PowerOff, 
  Calendar, Activity, ArrowRightLeft, Info 
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface HTWStandardUncertainty {
  id?: number;
  valid_from: string;
  valid_upto: string;
  torque_nm: number;
  applied_torque: number;
  indicated_torque: number;
  error_value: number;
  uncertainty_percent: number;
  is_active: boolean;
}

interface HTWStandardUncertaintyManagerProps {
  onBack: () => void;
}

// --- SKELETON COMPONENT ---
const HTWStandardUncertaintySkeleton = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20 animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[...Array(7)].map((_, i) => (
                <th key={i} className="px-6 py-4">
                  <div className="h-4 w-20 bg-slate-200 rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="h-3 w-24 bg-slate-200 rounded"></div>
                    <div className="h-3 w-24 bg-slate-200 rounded"></div>
                  </div>
                </td>
                <td className="px-6 py-4"><div className="h-5 w-16 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="h-3 w-20 bg-slate-200 rounded"></div>
                    <div className="h-3 w-20 bg-slate-200 rounded"></div>
                  </div>
                </td>
                <td className="px-6 py-4"><div className="h-5 w-16 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-5 w-12 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-200 rounded-full"></div></td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <div className="h-8 w-8 bg-slate-200 rounded"></div>
                    <div className="h-8 w-8 bg-slate-200 rounded"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN MANAGER COMPONENT
// ============================================================================

export const HTWStandardUncertaintyManager: React.FC<HTWStandardUncertaintyManagerProps> = ({ onBack }) => {
  const [currentView, setCurrentView] = useState<'list' | 'add'>('list');
  
  // State for Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HTWStandardUncertainty | null>(null);

  // State to control when the list refreshes
  const [refreshKey, setRefreshKey] = useState(0);

  // Handle Scroll Locking
  useEffect(() => {
    if (isEditModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isEditModalOpen]);

  // Handlers
  const handleAddNew = () => {
    setCurrentView('add');
  };

  const handleEdit = (item: HTWStandardUncertainty) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
    // Note: We DO NOT change refreshKey here, so the list behind stays static
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setIsEditModalOpen(false);
  };

  const handleSaveSuccess = () => {
    // Increment key to force list reload only after successful save
    setRefreshKey(prev => prev + 1);
    setCurrentView('list');
  };

  const handleEditSuccess = () => {
    // Increment key to force list reload only after successful update
    setRefreshKey(prev => prev + 1);
    closeEditModal();
  };

  // 1. Render Add Page
  if (currentView === 'add') {
    return (
      <AddUncertaintyPage 
        onCancel={() => setCurrentView('list')} 
        onSuccess={handleSaveSuccess} 
      />
    );
  }

  // 2. Render List (Default) + Edit Modal
  return (
    <div className="animate-fadeIn">
      <HTWStandardUncertaintyList 
        onBack={onBack} 
        onAddNew={handleAddNew} 
        onEdit={handleEdit}
        // Pass the controlled key. It only changes on save, not on modal open.
        refreshTrigger={refreshKey}
      />

      {/* 2. USED PORTAL FOR EDIT MODAL */}
      {isEditModalOpen && editingItem && createPortal(
        <EditUncertaintyModal 
          item={editingItem} 
          onCancel={closeEditModal} 
          onSuccess={handleEditSuccess} 
        />,
        document.body
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT 1: LIST VIEW
// ============================================================================

interface HTWStandardUncertaintyListProps {
  onBack: () => void;
  onAddNew: () => void;
  onEdit: (item: HTWStandardUncertainty) => void;
  refreshTrigger?: number;
}

function HTWStandardUncertaintyList({ onBack, onAddNew, onEdit, refreshTrigger }: HTWStandardUncertaintyListProps) {
  const [data, setData] = useState<HTWStandardUncertainty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Only set loading true if we don't have data yet (initial load)
      // or if you prefer a hard reload every time, keep it as is. 
      // If you want "silent refresh", remove setLoading(true).
      setLoading(true); 
      setError(null);
      const response = await api.get('/htw-standard-uncertainty/');
      setData(response.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load data');
      setData([]);
    } finally {
      // Small delay to make skeleton visible during fast loads
      setTimeout(() => setLoading(false), 300);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const handleToggleStatus = async (item: HTWStandardUncertainty) => {
    if (!item.id) return;
    try {
      setTogglingId(item.id);
      const newStatus = !item.is_active;
      await api.patch(`/htw-standard-uncertainty/${item.id}`, null, {
        params: { is_active: newStatus }
      });
      setData(prev => prev.map(s => s.id === item.id ? { ...s, is_active: newStatus } : s));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      setDeletingId(id);
      await api.delete(`/htw-standard-uncertainty/${id}`);
      setData(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Activity className="text-blue-600" size={24} />
                Interpolation Ranges
            </h3>
            <p className="text-sm text-gray-500">Manage interpolation uncertainty data points</p>
          </div>
        </div>
        <button onClick={onAddNew} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors">
          <Plus size={16} className="mr-2" /> Add New Record
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {loading ? (
        <HTWStandardUncertaintySkeleton />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20">
          {/* Added mb-20 for safe spacing with footer */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Valid Range</th>
                  <th className="px-6 py-4">Torque (Nm)</th>
                  <th className="px-6 py-4">Applied vs Indicated</th>
                  <th className="px-6 py-4">Error</th>
                  <th className="px-6 py-4">Uncertainty (%)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No records found.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-xs space-y-1">
                          <span className="text-gray-600 flex items-center gap-1"><Calendar size={10}/> {formatDate(item.valid_from)}</span>
                          <span className="text-gray-400 text-[10px] pl-4">to</span>
                          <span className="text-gray-600 flex items-center gap-1"><Calendar size={10}/> {formatDate(item.valid_upto)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-gray-800">{item.torque_nm}</td>
                      <td className="px-6 py-4 text-xs space-y-1">
                        <div className="flex justify-between w-32"><span className="text-gray-500">App:</span> <span className="font-mono">{item.applied_torque}</span></div>
                        <div className="flex justify-between w-32"><span className="text-gray-500">Ind:</span> <span className="font-mono">{item.indicated_torque}</span></div>
                      </td>
                      <td className={`px-6 py-4 font-mono font-medium ${item.error_value < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.error_value}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-700">{item.uncertainty_percent}%</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingId === item.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {togglingId === item.id ? <Loader2 size={12} className="animate-spin mr-1" /> : (item.is_active ? <CheckCircle size={12} className="mr-1" /> : <PowerOff size={12} className="mr-1" />)}
                          {item.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                            <button onClick={() => onEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                                <Edit size={16} />
                            </button>
                            <button onClick={() => handleDelete(item.id!)} disabled={deletingId === item.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50" title="Delete">
                                {deletingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
    </div>
  );
}

// ============================================================================
// COMPONENT 2: ADD PAGE (Full Page)
// ============================================================================

interface AddUncertaintyPageProps {
  onCancel: () => void;
  onSuccess: () => void;
}

const AddUncertaintyPage: React.FC<AddUncertaintyPageProps> = ({ onCancel, onSuccess }) => {
  const [formData, setFormData] = useState({
    valid_from: '',
    valid_upto: '',
    torque_nm: '',
    applied_torque: '',
    indicated_torque: '',
    error_value: '',
    uncertainty_percent: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
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
    setLoading(true);

    try {
      const payload = {
        ...formData,
        torque_nm: parseFloat(formData.torque_nm),
        applied_torque: parseFloat(formData.applied_torque),
        indicated_torque: parseFloat(formData.indicated_torque),
        error_value: parseFloat(formData.error_value),
        uncertainty_percent: parseFloat(formData.uncertainty_percent),
      };

      await api.post('/htw-standard-uncertainty/', payload);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save record.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto mb-20">
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
            <Plus className="w-5 h-5 text-blue-600 mr-2" />
            Add New Standard Uncertainty
          </h3>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center">
            <Info size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Valid From</label>
              <input
                type="date"
                name="valid_from"
                value={formData.valid_from}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Valid Up To</label>
              <input
                type="date"
                name="valid_upto"
                value={formData.valid_upto}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Torque Values */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Torque (Nm)</label>
              <input
                type="number"
                name="torque_nm"
                value={formData.torque_nm}
                onChange={handleChange}
                required step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Applied Torque</label>
              <input
                type="number"
                name="applied_torque"
                value={formData.applied_torque}
                onChange={handleChange}
                required step="0.0001"
                placeholder="0.0000"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Indicated Torque</label>
              <input
                type="number"
                name="indicated_torque"
                value={formData.indicated_torque}
                onChange={handleChange}
                required step="0.0001"
                placeholder="0.0000"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Error Value</label>
              <input
                type="number"
                name="error_value"
                value={formData.error_value}
                onChange={handleChange}
                required step="0.0001"
                placeholder="0.0000"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Uncertainty (%)</label>
            <input
              type="number"
              name="uncertainty_percent"
              value={formData.uncertainty_percent}
              onChange={handleChange}
              required step="0.0001"
              placeholder="0.0000"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
            />
          </div>

          <div className="flex items-center pt-2">
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Active' : 'Inactive'}</span>
            </label>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-70 transition-all">
              {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              Save Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT 3: EDIT MODAL (Popup)
// ============================================================================

interface EditUncertaintyModalProps {
  item: HTWStandardUncertainty;
  onCancel: () => void;
  onSuccess: () => void;
}

const EditUncertaintyModal: React.FC<EditUncertaintyModalProps> = ({ item, onCancel, onSuccess }) => {
  const [formData, setFormData] = useState({
    valid_from: item.valid_from ? item.valid_from.split('T')[0] : '',
    valid_upto: item.valid_upto ? item.valid_upto.split('T')[0] : '',
    torque_nm: item.torque_nm.toString(),
    applied_torque: item.applied_torque.toString(),
    indicated_torque: item.indicated_torque.toString(),
    error_value: item.error_value.toString(),
    uncertainty_percent: item.uncertainty_percent.toString(),
    is_active: item.is_active
  });
  const [loading, setLoading] = useState(false);
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
    setLoading(true);

    try {
      const payload = {
        ...formData,
        torque_nm: parseFloat(formData.torque_nm),
        applied_torque: parseFloat(formData.applied_torque),
        indicated_torque: parseFloat(formData.indicated_torque),
        error_value: parseFloat(formData.error_value),
        uncertainty_percent: parseFloat(formData.uncertainty_percent),
      };

      await api.put(`/htw-standard-uncertainty/${item.id}`, payload);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update record.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Z-INDEX set to 99999, though Portal moves it to body level
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="text-blue-600" size={20} />
            Edit Uncertainty Record
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
              <input type="date" name="valid_from" value={formData.valid_from} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Up To</label>
              <input type="date" name="valid_upto" value={formData.valid_upto} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Torque (Nm)</label>
              <input type="number" name="torque_nm" value={formData.torque_nm} onChange={handleChange} required step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Applied Torque</label>
              <input type="number" name="applied_torque" value={formData.applied_torque} onChange={handleChange} required step="0.0001" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Indicated Torque</label>
              <input type="number" name="indicated_torque" value={formData.indicated_torque} onChange={handleChange} required step="0.0001" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Error Value</label>
              <input type="number" name="error_value" value={formData.error_value} onChange={handleChange} required step="0.0001" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Uncertainty (%)</label>
            <input type="number" name="uncertainty_percent" value={formData.uncertainty_percent} onChange={handleChange} required step="0.0001" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
          </div>

          <div className="flex items-center pt-2">
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Active' : 'Inactive'}</span>
            </label>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-70 transition-all">
              {loading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              Update Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};