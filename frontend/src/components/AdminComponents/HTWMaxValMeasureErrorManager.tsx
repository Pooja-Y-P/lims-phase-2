import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { createPortal } from 'react-dom'; // 1. Import createPortal
import { 
  Loader2, Plus, ArrowLeft, CheckCircle, 
  PowerOff, Trash2, Edit, AlertCircle, Save, TrendingUp, 
  X, ArrowRightLeft,  
} from 'lucide-react';
import { api } from '../../api/config'; // Adjust path

// --- TYPES ---
export interface HTWMaxValMeasureErr {
  id?: number;
  range_min: number;
  range_max: number;
  un_percent: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface HTWMaxValMeasureErrorManagerProps {
  onBack: () => void;
}

// ============================================================================
// MAIN MANAGER COMPONENT
// ============================================================================
export const HTWMaxValMeasureErrorManager: React.FC<HTWMaxValMeasureErrorManagerProps> = ({ onBack }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');
  const [data, setData] = useState<HTWMaxValMeasureErr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- EDIT MODAL STATE ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HTWMaxValMeasureErr | null>(null);

  // --- ACTION LOADING STATE ---
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  // --- API FETCH ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/htw/max-val-measure-err');
      setData(response.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load measurement error data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- HANDLERS ---
  const handleAddNewClick = () => {
    setViewMode('add');
  };

  const handleEditClick = (item: HTWMaxValMeasureErr) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      setDeletingId(id);
      await api.delete(`/htw/max-val-measure-err/${id}`);
      setData(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete record');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (payload: HTWMaxValMeasureErr, isEdit: boolean) => {
    setSubmitting(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/htw/max-val-measure-err/${editingItem.id}`, payload);
        setIsEditModalOpen(false);
        setEditingItem(null);
      } else {
        await api.post('/htw/max-val-measure-err', payload);
        setViewMode('list');
      }
      fetchData();
    } catch (err: any) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  // --- RENDER ---
  if (viewMode === 'add') {
    return (
      <AddMaxErrorPage 
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
               <TrendingUp size={24} className="text-blue-500" />
               Max Measurement Error (Un%)
             </h3>
             <p className="text-sm text-gray-500">Uncertainty ranges for interpolation</p>
          </div>
        </div>
        <button 
          onClick={handleAddNewClick} 
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm transition-colors"
        >
            <Plus size={16} className="mr-2" /> Add Limit
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
          <AlertCircle size={18} className="mr-2" /> {error}
        </div>
      )}

      {/* List Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-gray-500">Loading data...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20">
          {/* Added mb-20 for spacing with footer */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Min Range</th>
                  <th className="px-6 py-4">Max Range</th>
                  <th className="px-6 py-4">Max Error (Un %)</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No records found.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-gray-700">{item.range_min}</td>
                      <td className="px-6 py-4 font-mono font-medium text-gray-700">{item.range_max}</td>
                      <td className="px-6 py-4 font-bold text-blue-600">{item.un_percent}%</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.is_active 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {item.is_active ? <CheckCircle size={12} className="mr-1"/> : <PowerOff size={12} className="mr-1"/>}
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                           <button 
                             onClick={() => handleEditClick(item)} 
                             className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                             title="Edit"
                           >
                              <Edit size={16} />
                           </button>
                           <button 
                             onClick={() => handleDelete(item.id!)} 
                             disabled={deletingId === item.id} 
                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50" 
                             title="Delete"
                           >
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

      {/* 2. USED PORTAL FOR EDIT MODAL */}
      {isEditModalOpen && editingItem && createPortal(
        <EditMaxErrorModal 
          item={editingItem}
          onCancel={() => setIsEditModalOpen(false)}
          onSave={(payload) => handleSave(payload, true)}
          submitting={submitting}
        />,
        document.body
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT 1: ADD PAGE (Full Page View)
// ============================================================================
interface AddPageProps {
  onCancel: () => void;
  onSave: (payload: HTWMaxValMeasureErr) => Promise<void>;
  submitting: boolean;
}

const AddMaxErrorPage: React.FC<AddPageProps> = ({ onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    range_min: '',
    range_max: '',
    un_percent: '',
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
    
    const min = parseFloat(formData.range_min);
    const max = parseFloat(formData.range_max);
    const un = parseFloat(formData.un_percent);

    if (isNaN(min) || isNaN(max) || isNaN(un)) {
      setError("Please enter valid numeric values.");
      return;
    }
    if (min >= max) {
      setError("Range Minimum must be less than Range Maximum.");
      return;
    }

    try {
      await onSave({
        range_min: min,
        range_max: max,
        un_percent: un,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save");
    }
  };

  return (
    <div className="max-w-xl mx-auto animate-fadeIn mb-20">
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
            Add Max Error Limit
          </h3>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center">
            <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Range Min</label>
              <input
                type="number"
                name="range_min"
                value={formData.range_min}
                onChange={handleChange}
                required
                step="0.0001"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Range Max</label>
              <input
                type="number"
                name="range_max"
                value={formData.range_max}
                onChange={handleChange}
                required
                step="0.0001"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Error (Un %)</label>
            <div className="relative">
              <input
                type="number"
                name="un_percent"
                value={formData.un_percent}
                onChange={handleChange}
                required
                step="0.0001"
                className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
              <span className="absolute right-4 top-2.5 text-gray-400 font-bold">%</span>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
             <span className="text-sm font-medium text-gray-700">Status</span>
             <label className="relative inline-flex items-center cursor-pointer">
               <input 
                  type="checkbox" 
                  name="is_active" 
                  checked={formData.is_active} 
                  onChange={handleChange} 
                  className="sr-only peer" 
               />
               <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               <span className="ml-3 text-sm font-medium text-gray-700">{formData.is_active ? 'Active' : 'Inactive'}</span>
             </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm disabled:opacity-70 transition-all">
              {submitting ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
              Save Limit
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
  item: HTWMaxValMeasureErr;
  onCancel: () => void;
  onSave: (payload: HTWMaxValMeasureErr) => Promise<void>;
  submitting: boolean;
}

const EditMaxErrorModal: React.FC<EditModalProps> = ({ item, onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    range_min: item.range_min.toString(),
    range_max: item.range_max.toString(),
    un_percent: item.un_percent.toString(),
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
    
    const min = parseFloat(formData.range_min);
    const max = parseFloat(formData.range_max);
    const un = parseFloat(formData.un_percent);

    if (isNaN(min) || isNaN(max) || isNaN(un)) {
      setError("Please enter valid numeric values.");
      return;
    }
    if (min >= max) {
      setError("Range Minimum must be less than Range Maximum.");
      return;
    }

    try {
      await onSave({
        range_min: min,
        range_max: max,
        un_percent: un,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update");
    }
  };

  return (
    // Z-INDEX set high, although Portal moves it to body level
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="text-blue-500" size={20} />
            Edit Max Error Limit
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

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Range Min</label>
                <input
                  type="number"
                  name="range_min"
                  value={formData.range_min}
                  onChange={handleChange}
                  required
                  step="0.0001"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Range Max</label>
                <input
                  type="number"
                  name="range_max"
                  value={formData.range_max}
                  onChange={handleChange}
                  required
                  step="0.0001"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Error (Un %)</label>
              <div className="relative">
                <input
                  type="number"
                  name="un_percent"
                  value={formData.un_percent}
                  onChange={handleChange}
                  required
                  step="0.0001"
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
                <span className="absolute right-4 top-2.5 text-gray-400 font-bold">%</span>
              </div>
            </div>

            <div className="flex items-center pt-2">
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
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button type="button" onClick={onCancel} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm disabled:opacity-70 transition-all">
              {submitting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              Update Limit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};