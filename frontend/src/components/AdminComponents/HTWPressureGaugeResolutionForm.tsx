import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { api } from '../../api/config'; // Adjust path as needed
import {
  ArrowLeft, Plus, Edit, Trash2, X, Save,
  Loader2, AlertCircle, Activity, ArrowRightLeft,
  CheckCircle, PowerOff, Ruler, Gauge, Calendar, Eye
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface HTWPressureGaugeResolution {
  id?: number;
  pressure: number;
  unit: string;
  valid_upto: string | null;
  is_active: boolean;
}

interface HTWPressureGaugeResolutionManagerProps {
  onBack: () => void;
}

// ============================================================================
// MAIN MANAGER COMPONENT
// ============================================================================

export const HTWPressureGaugeResolutionManager: React.FC<HTWPressureGaugeResolutionManagerProps> = ({ onBack }) => {
  // --- STATE: Data ---
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');
  const [data, setData] = useState<HTWPressureGaugeResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE: Modals ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HTWPressureGaugeResolution | null>(null);
  
  // View Details Modal State
  const [viewingItem, setViewingItem] = useState<HTWPressureGaugeResolution | null>(null);

  // --- STATE: Actions ---
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // --- API FETCH ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/htw-pressure-gauge-resolutions/');
      setData(response.data || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load resolutions');
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
  const handleEditClick = (item: HTWPressureGaugeResolution) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  // 3. Status Toggle
  const handleToggleStatus = async (item: HTWPressureGaugeResolution) => {
    if (!item.id) return;
    try {
      setTogglingId(item.id);
      const newStatus = !item.is_active;
      await api.patch(`/htw-pressure-gauge-resolutions/${item.id}`, null, { 
        params: { is_active: newStatus } 
      });
      setData(prev => prev.map(r => r.id === item.id ? { ...r, is_active: newStatus } : r));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  // 4. Delete
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this resolution?")) return;
    try {
      setDeletingId(id);
      await api.delete(`/htw-pressure-gauge-resolutions/${id}`);
      setData(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // 5. Unified Save Handler
  const handleSave = async (payload: HTWPressureGaugeResolution, isEdit: boolean) => {
    setSubmitting(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/htw-pressure-gauge-resolutions/${editingItem.id}`, payload);
        setIsEditModalOpen(false);
        setEditingItem(null);
      } else {
        await api.post('/htw-pressure-gauge-resolutions/', payload);
        setViewMode('list');
      }
      fetchData(); // Refresh list
    } catch (err: any) {
      throw err; // Propagate error to form component
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Indefinite';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // --- RENDER ---

  if (viewMode === 'add') {
    return (
      <AddResolutionPage
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
               <Activity className="text-blue-600" size={24} />
               Pressure Gauge Resolutions
             </h3>
             <p className="text-sm text-gray-500">Standard resolution values for calibration</p>
          </div>
        </div>
        <button 
          onClick={handleAddNewClick} 
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
        >
            <Plus size={16} className="mr-2" /> Add Resolution
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-500">Loading resolutions...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Pressure Value</th>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Valid Upto</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No resolutions found.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900">{item.pressure}</td>
                      <td className="px-6 py-4 text-gray-600">{item.unit}</td>
                      <td className="px-6 py-4 text-gray-500">{formatDate(item.valid_upto)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingId === item.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {togglingId === item.id ? <Loader2 size={12} className="animate-spin mr-1"/> : (item.is_active ? <CheckCircle size={12} className="mr-1"/> : <PowerOff size={12} className="mr-1"/>)}
                          {item.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setViewingItem(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
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

      {/* View Detail Modal */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full animate-fadeIn p-6">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Ruler size={18} /> Details</h3>
                <button onClick={() => setViewingItem(null)}><X size={18} className="text-gray-400" /></button>
             </div>
             <div className="text-center bg-blue-50 p-4 rounded-lg mb-4">
               <span className="text-2xl font-bold">{viewingItem.pressure}</span> <span className="text-gray-500">{viewingItem.unit}</span>
             </div>
             <div className="text-sm space-y-2">
                <p><span className="font-medium">Valid Upto:</span> {formatDate(viewingItem.valid_upto)}</p>
                <p><span className="font-medium">Status:</span> {viewingItem.is_active ? 'Active' : 'Inactive'}</p>
             </div>
          </div>
        </div>
      )}

      {/* Edit Modal (Popup) */}
      {isEditModalOpen && editingItem && (
        <EditResolutionModal 
          item={editingItem}
          onCancel={() => setIsEditModalOpen(false)}
          onSave={(payload) => handleSave(payload, true)}
          submitting={submitting}
        />
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT 1: ADD PAGE (Full Page View)
// ============================================================================
interface AddPageProps {
  onCancel: () => void;
  onSave: (payload: HTWPressureGaugeResolution) => Promise<void>;
  submitting: boolean;
}

const AddResolutionPage: React.FC<AddPageProps> = ({ onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    pressure: '',
    unit: 'bar',
    valid_upto: '',
    is_active: true
  });
  const [error, setError] = useState<string | null>(null);

  const commonUnits = ['bar', 'psi', 'kg/cm²', 'kPa', 'MPa'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.pressure || parseFloat(formData.pressure) < 0) {
      setError("Please enter a valid pressure value.");
      return;
    }

    try {
      await onSave({
        pressure: parseFloat(formData.pressure),
        unit: formData.unit,
        valid_upto: formData.valid_upto || null,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save resolution.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn">
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
            Add New Resolution
          </h3>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center">
            <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Pressure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pressure Value</label>
              <div className="relative">
                <input 
                  type="number" name="pressure" value={formData.pressure} onChange={handleChange} 
                  required step="0.0001" placeholder="0.0000" 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" 
                />
                <Gauge className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input 
                type="text" name="unit" value={formData.unit} onChange={handleChange} 
                required list="unit-options" placeholder="e.g. bar" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
              />
              <datalist id="unit-options">
                 {commonUnits.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>

            {/* Valid Upto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Upto</label>
              <div className="relative">
                <input 
                  type="date" name="valid_upto" value={formData.valid_upto} onChange={handleChange} 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                />
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
              <p className="text-xs text-gray-400 mt-1">Leave blank if valid indefinitely</p>
            </div>

            {/* Is Active Toggle */}
            <div className="flex items-center h-full pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                {/* FIXED TYPO BELOW: translate-x-full instead of tranblue-x-full */}
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Active' : 'Inactive'}</span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button type="button" onClick={onCancel} className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-70 transition-all">
              {submitting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              Save Resolution
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
  item: HTWPressureGaugeResolution;
  onCancel: () => void;
  onSave: (payload: HTWPressureGaugeResolution) => Promise<void>;
  submitting: boolean;
}

const EditResolutionModal: React.FC<EditModalProps> = ({ item, onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    pressure: item.pressure.toString(),
    unit: item.unit,
    valid_upto: item.valid_upto ? item.valid_upto.split('T')[0] : '',
    is_active: item.is_active
  });
  const [error, setError] = useState<string | null>(null);
  const commonUnits = ['bar', 'psi', 'kg/cm²', 'kPa', 'MPa'];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.pressure || parseFloat(formData.pressure) < 0) {
      setError("Please enter a valid pressure value.");
      return;
    }

    try {
      await onSave({
        pressure: parseFloat(formData.pressure),
        unit: formData.unit,
        valid_upto: formData.valid_upto || null,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update resolution.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="text-blue-500" size={20} />
            Edit Resolution
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
            
            {/* Pressure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pressure Value</label>
              <div className="relative">
                <input 
                  type="number" name="pressure" value={formData.pressure} onChange={handleChange} 
                  required step="0.0001" 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" 
                />
                <Gauge className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <input 
                type="text" name="unit" value={formData.unit} onChange={handleChange} 
                required list="unit-options" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
              />
              <datalist id="unit-options">
                 {commonUnits.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>

            {/* Valid Upto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Upto</label>
              <div className="relative">
                <input 
                  type="date" name="valid_upto" value={formData.valid_upto} onChange={handleChange} 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                />
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>

            {/* Is Active Toggle */}
            <div className="flex items-center h-full pt-6">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
                {/* FIXED TYPO BELOW: translate-x-full instead of tranblue-x-full */}
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Active' : 'Inactive'}</span>
              </label>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button type="button" onClick={onCancel} disabled={submitting} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="flex items-center px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-70 transition-all">
              {submitting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              Update Resolution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};