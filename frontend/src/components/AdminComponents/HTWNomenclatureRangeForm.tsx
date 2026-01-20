import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { 
  ArrowLeft, Plus, Edit, Trash2, X, Save, 
  Loader2, AlertCircle, Activity, ArrowRightLeft, 
  ShieldCheck, Calendar, CheckCircle, PowerOff 
} from 'lucide-react';
import { api, ENDPOINTS } from '../../api/config'; // Adjust path

// --- TYPES ---
export interface HTWNomenclatureRange {
  id?: number;
  range_min: number;
  range_max: number;
  nomenclature: string;
  is_active: boolean;
  valid_upto: string | null;
  master_standard_id: number;
}

interface MasterStandardSimple {
  id: number;
  nomenclature: string;
  manufacturer: string;
}

interface HTWNomenclatureRangeManagerProps {
  onBack: () => void;
}

// ============================================================================
// MAIN MANAGER COMPONENT
// ============================================================================
export const HTWNomenclatureRangeManager: React.FC<HTWNomenclatureRangeManagerProps> = ({ onBack }) => {
  // --- STATE: Data ---
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');
  const [data, setData] = useState<HTWNomenclatureRange[]>([]);
  const [masterStandards, setMasterStandards] = useState<MasterStandardSimple[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE: Edit Modal ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HTWNomenclatureRange | null>(null);

  // --- STATE: Actions ---
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // --- API FETCH ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/htw-nomenclature-ranges/');
      setData(response.data || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load ranges');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMasterStandards = useCallback(async () => {
    try {
      const response = await api.get(ENDPOINTS.HTW_MASTER_STANDARDS.LIST);
      setMasterStandards(response.data || []);
    } catch (err) {
      console.error("Failed to load master standards", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchMasterStandards();
  }, [fetchData, fetchMasterStandards]);

  // --- HANDLERS ---

  // 1. Switch to Add Page
  const handleAddNewClick = () => {
    setViewMode('add');
  };

  // 2. Open Edit Modal
  const handleEditClick = (item: HTWNomenclatureRange) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  // 3. Status Toggle
  const handleToggleStatus = async (item: HTWNomenclatureRange) => {
    if(!item.id) return;
    try {
      setTogglingId(item.id);
      const newStatus = !item.is_active;
      await api.patch(`/htw-nomenclature-ranges/${item.id}/status`, null, {
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
    if (!window.confirm("Are you sure you want to delete this range?")) return;
    try {
      setDeletingId(id);
      await api.delete(`/htw-nomenclature-ranges/${id}`);
      setData(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // 5. Unified Save Handler
  const handleSave = async (payload: HTWNomenclatureRange, isEdit: boolean) => {
    setSubmitting(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/htw-nomenclature-ranges/${editingItem.id}`, payload);
        setIsEditModalOpen(false);
        setEditingItem(null);
      } else {
        await api.post('/htw-nomenclature-ranges/', payload);
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
      <AddRangePage 
        onCancel={() => setViewMode('list')}
        onSave={(payload) => handleSave(payload, false)}
        masterStandards={masterStandards}
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
               <Activity className="text-blue-500" size={24} />
               Nomenclature Ranges
             </h3>
             <p className="text-sm text-gray-500">Manage standard ranges for master selection</p>
          </div>
        </div>
        <button 
          onClick={handleAddNewClick} 
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm transition-colors"
        >
            <Plus size={16} className="mr-2" /> Add New Range
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-gray-500">Loading ranges...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Nomenclature</th>
                  <th className="px-6 py-4">Range (Min - Max)</th>
                  <th className="px-6 py-4">Master Std ID</th>
                  <th className="px-6 py-4">Valid Upto</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No ranges defined.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.nomenclature}</td>
                      <td className="px-6 py-4 font-mono text-gray-600">
                        {item.range_min} - {item.range_max}
                      </td>
                      <td className="px-6 py-4 text-gray-500">#{item.master_standard_id}</td>
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

      {/* Edit Modal (Popup) */}
      {isEditModalOpen && editingItem && (
        <EditRangeModal 
          item={editingItem}
          masterStandards={masterStandards}
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
  onSave: (payload: HTWNomenclatureRange) => Promise<void>;
  masterStandards: MasterStandardSimple[];
  submitting: boolean;
}

const AddRangePage: React.FC<AddPageProps> = ({ onCancel, onSave, masterStandards, submitting }) => {
  const [formData, setFormData] = useState({
    range_min: '',
    range_max: '',
    nomenclature: '',
    valid_upto: '',
    master_standard_id: '',
    is_active: true
  });
  const [error, setError] = useState<string | null>(null);

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

    if (parseFloat(formData.range_min) >= parseFloat(formData.range_max)) {
      setError("Range Minimum must be less than Range Maximum.");
      return;
    }
    if (!formData.master_standard_id) {
      setError("Please select a Master Standard.");
      return;
    }

    try {
      await onSave({
        range_min: parseFloat(formData.range_min),
        range_max: parseFloat(formData.range_max),
        nomenclature: formData.nomenclature,
        valid_upto: formData.valid_upto || null,
        master_standard_id: parseInt(formData.master_standard_id),
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save range.");
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
            Add New Nomenclature Range
          </h3>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center">
            <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Master Standard */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Master Standard</label>
              <div className="relative">
                <select
                  name="master_standard_id"
                  value={formData.master_standard_id}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none outline-none"
                >
                  <option value="">Select a Master Standard...</option>
                  {masterStandards.map(std => (
                    <option key={std.id} value={std.id}>
                      {std.nomenclature} ({std.manufacturer})
                    </option>
                  ))}
                </select>
                <ShieldCheck className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>

            {/* Nomenclature */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomenclature Name</label>
              <input 
                type="text" 
                name="nomenclature" 
                value={formData.nomenclature} 
                onChange={handleChange} 
                required 
                placeholder="e.g. DIGITAL PRESSURE GAUGE" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
              />
            </div>

            {/* Range Min */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Range Minimum</label>
              <input 
                type="number" name="range_min" value={formData.range_min} onChange={handleChange} 
                required step="0.0001" placeholder="0.0000" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" 
              />
            </div>

            {/* Range Max */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Range Maximum</label>
              <input 
                type="number" name="range_max" value={formData.range_max} onChange={handleChange} 
                required step="0.0001" placeholder="1000.0000" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" 
              />
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
              Save Range
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
  item: HTWNomenclatureRange;
  masterStandards: MasterStandardSimple[];
  onCancel: () => void;
  onSave: (payload: HTWNomenclatureRange) => Promise<void>;
  submitting: boolean;
}

const EditRangeModal: React.FC<EditModalProps> = ({ item, masterStandards, onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    range_min: item.range_min.toString(),
    range_max: item.range_max.toString(),
    nomenclature: item.nomenclature,
    valid_upto: item.valid_upto ? item.valid_upto.split('T')[0] : '',
    master_standard_id: item.master_standard_id.toString(),
    is_active: item.is_active
  });
  const [error, setError] = useState<string | null>(null);

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

    if (parseFloat(formData.range_min) >= parseFloat(formData.range_max)) {
      setError("Range Minimum must be less than Range Maximum.");
      return;
    }
    if (!formData.master_standard_id) {
      setError("Please select a Master Standard.");
      return;
    }

    try {
      await onSave({
        range_min: parseFloat(formData.range_min),
        range_max: parseFloat(formData.range_max),
        nomenclature: formData.nomenclature,
        valid_upto: formData.valid_upto || null,
        master_standard_id: parseInt(formData.master_standard_id),
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update range.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="text-blue-500" size={20} />
            Edit Nomenclature Range
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
            
            {/* Master Standard */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Master Standard</label>
              <div className="relative">
                <select
                  name="master_standard_id"
                  value={formData.master_standard_id}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none outline-none"
                >
                  <option value="">Select a Master Standard...</option>
                  {masterStandards.map(std => (
                    <option key={std.id} value={std.id}>
                      {std.nomenclature} ({std.manufacturer})
                    </option>
                  ))}
                </select>
                <ShieldCheck className="absolute left-3 top-2.5 text-gray-400" size={18} />
              </div>
            </div>

            {/* Nomenclature */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomenclature Name</label>
              <input 
                type="text" 
                name="nomenclature" 
                value={formData.nomenclature} 
                onChange={handleChange} 
                required 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
              />
            </div>

            {/* Range Min */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Range Minimum</label>
              <input 
                type="number" name="range_min" value={formData.range_min} onChange={handleChange} 
                required step="0.0001" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" 
              />
            </div>

            {/* Range Max */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Range Maximum</label>
              <input 
                type="number" name="range_max" value={formData.range_max} onChange={handleChange} 
                required step="0.0001" 
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono" 
              />
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
              Update Range
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};