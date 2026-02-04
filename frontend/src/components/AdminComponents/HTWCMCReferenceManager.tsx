import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { createPortal } from 'react-dom'; // 1. Import createPortal
import { 
  Loader2, Plus, ArrowLeft, CheckCircle, 
  PowerOff, Edit, AlertCircle, Save, Scale,
  Trash2, X, 
} from 'lucide-react';
import { api } from '../../api/config';

// --- TYPES ---
export interface HTWCMCReference {
  id?: number;
  lower_measure_range: number;
  higher_measure_range: number;
  cmc_percent: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface HTWCMCReferenceManagerProps {
  onBack: () => void;
}

// ============================================================================
// MAIN MANAGER COMPONENT
// ============================================================================
export const HTWCMCReferenceManager: React.FC<HTWCMCReferenceManagerProps> = ({ onBack }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');
  const [data, setData] = useState<HTWCMCReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE: Edit Modal ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HTWCMCReference | null>(null);

  // --- STATE: Actions ---
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

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
      const response = await api.get('/htw/cmc');
      setData(response.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load CMC reference data');
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

  const handleEditClick = (item: HTWCMCReference) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleToggleStatus = async (item: HTWCMCReference) => {
    if(!item.id) return;
    try {
      setTogglingId(item.id);
      const updatedItem = { ...item, is_active: !item.is_active };
      await api.put(`/htw/cmc/${item.id}`, updatedItem);
      setData(prev => prev.map(r => r.id === item.id ? updatedItem : r));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    try {
      setDeletingId(id);
      await api.delete(`/htw/cmc/${id}`);
      setData(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (payload: HTWCMCReference, isEdit: boolean) => {
    setSubmitting(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/htw/cmc/${editingItem.id}`, payload);
        setIsEditModalOpen(false);
        setEditingItem(null);
      } else {
        await api.post('/htw/cmc', payload);
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
      <AddCMCPage 
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
               <Scale size={24} className="text-blue-500" />
               CMC Reference Scopes
             </h3>
             <p className="text-sm text-gray-500">Hydraulic CMC Backup Data Limits</p>
          </div>
        </div>
        <button 
          onClick={handleAddNewClick} 
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm transition-colors"
        >
            <Plus size={16} className="mr-2" /> Add New Scope
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-gray-500">Loading records...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20">
          {/* Added mb-20 to ensure content isn't hidden if footer overlaps before modal opens */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Lower Range</th>
                  <th className="px-6 py-4">Higher Range</th>
                  <th className="px-6 py-4">CMC (%)</th>
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
                      <td className="px-6 py-4 font-mono font-medium text-gray-700">{item.lower_measure_range}</td>
                      <td className="px-6 py-4 font-mono font-medium text-gray-700">{item.higher_measure_range}</td>
                      <td className="px-6 py-4 font-bold text-blue-600">{item.cmc_percent}%</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingId === item.id}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {togglingId === item.id ? <Loader2 size={12} className="animate-spin mr-1"/> : (item.is_active ? <CheckCircle size={12} className="mr-1"/> : <PowerOff size={12} className="mr-1"/>)}
                          {item.is_active ? 'Active' : 'Inactive'}
                        </button>
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
        <EditCMCModal 
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
  onSave: (payload: HTWCMCReference) => Promise<void>;
  submitting: boolean;
}

const AddCMCPage: React.FC<AddPageProps> = ({ onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    lower_measure_range: '',
    higher_measure_range: '',
    cmc_percent: '',
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

    const lower = parseFloat(formData.lower_measure_range);
    const higher = parseFloat(formData.higher_measure_range);
    const cmc = parseFloat(formData.cmc_percent);

    if (isNaN(lower) || isNaN(higher) || isNaN(cmc)) {
      setError("Please fill all numeric fields correctly.");
      return;
    }
    if (lower >= higher) {
      setError("Lower range must be less than higher range.");
      return;
    }

    try {
      await onSave({
        lower_measure_range: lower,
        higher_measure_range: higher,
        cmc_percent: cmc,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save record.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn mb-20"> 
      {/* Added mb-20 for safe spacing */}
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
            Add New CMC Scope
          </h3>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center">
            <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lower Range</label>
              <input
                type="number"
                name="lower_measure_range"
                value={formData.lower_measure_range}
                onChange={handleChange}
                required
                step="0.0001"
                placeholder="e.g. 200"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Higher Range</label>
              <input
                type="number"
                name="higher_measure_range"
                value={formData.higher_measure_range}
                onChange={handleChange}
                required
                step="0.0001"
                placeholder="e.g. 1500"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>

            {/* CMC */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">CMC Value (%)</label>
              <div className="relative">
                <input
                  type="number"
                  name="cmc_percent"
                  value={formData.cmc_percent}
                  onChange={handleChange}
                  required
                  step="0.0001"
                  placeholder="e.g. 0.58"
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
                <span className="absolute right-4 top-2.5 text-gray-400 font-bold">%</span>
              </div>
            </div>

            {/* Is Active Toggle */}
            <div className="flex items-center h-full pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Active' : 'Inactive'}</span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm disabled:opacity-70 transition-all">
              {submitting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              Save Scope
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
  item: HTWCMCReference;
  onCancel: () => void;
  onSave: (payload: HTWCMCReference) => Promise<void>;
  submitting: boolean;
}

const EditCMCModal: React.FC<EditModalProps> = ({ item, onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    lower_measure_range: item.lower_measure_range.toString(),
    higher_measure_range: item.higher_measure_range.toString(),
    cmc_percent: item.cmc_percent.toString(),
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

    const lower = parseFloat(formData.lower_measure_range);
    const higher = parseFloat(formData.higher_measure_range);
    const cmc = parseFloat(formData.cmc_percent);

    if (isNaN(lower) || isNaN(higher) || isNaN(cmc)) {
      setError("Please fill all numeric fields correctly.");
      return;
    }
    if (lower >= higher) {
      setError("Lower range must be less than higher range.");
      return;
    }

    try {
      await onSave({
        lower_measure_range: lower,
        higher_measure_range: higher,
        cmc_percent: cmc,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update record.");
    }
  };

  return (
    // Z-INDEX set high, though portal moves it to body level
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Scale className="text-blue-500" size={20} />
            Edit CMC Scope
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lower Range</label>
              <input
                type="number"
                name="lower_measure_range"
                value={formData.lower_measure_range}
                onChange={handleChange}
                required
                step="0.0001"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Higher Range</label>
              <input
                type="number"
                name="higher_measure_range"
                value={formData.higher_measure_range}
                onChange={handleChange}
                required
                step="0.0001"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">CMC Value (%)</label>
              <div className="relative">
                <input
                  type="number"
                  name="cmc_percent"
                  value={formData.cmc_percent}
                  onChange={handleChange}
                  required
                  step="0.0001"
                  className="w-full pl-4 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
                <span className="absolute right-4 top-2.5 text-gray-400 font-bold">%</span>
              </div>
            </div>

            <div className="flex items-center h-full pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
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
              Update Scope
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};