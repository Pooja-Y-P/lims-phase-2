import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { createPortal } from 'react-dom'; // 1. Import createPortal
import { 
  ArrowLeft, Plus, Edit, Trash2, X, Save, 
  Loader2, AlertCircle, Wrench, Settings,
  Eye, Info, CheckCircle, PowerOff 
} from 'lucide-react';
import { api } from '../../api/config'; // Adjust path

// --- TYPES ---
export interface HTWToolType {
  id?: number;
  tool_name: string;
  tool_category: string;
  operation_type: 'Indicating' | 'Setting';
  classification?: string; // Optional
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface HTWToolTypeManagerProps {
  onBack: () => void;
}

// --- SKELETON COMPONENT ---
const HTWToolTypeSkeleton = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20 animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {[...Array(6)].map((_, i) => (
                <th key={i} className="px-6 py-4">
                  <div className="h-4 w-24 bg-slate-200 rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><div className="h-5 w-32 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-5 w-24 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <div className="h-8 w-8 bg-slate-200 rounded"></div>
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
export const HTWToolTypeManager: React.FC<HTWToolTypeManagerProps> = ({ onBack }) => {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'list' | 'add'>('list');
  const [data, setData] = useState<HTWToolType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE: Modals ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HTWToolType | null>(null);
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<HTWToolType | null>(null);

  // --- STATE: Actions ---
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Handle Scroll Locking
  useEffect(() => {
    // Check if either Edit Modal OR View Modal is open
    if (isEditModalOpen || isViewModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isEditModalOpen, isViewModalOpen]);

  // --- API FETCH ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/htw/tool-types');
      setData(response.data || []);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load tool types');
    } finally {
      // Artificial delay for smoother skeleton transition
      setTimeout(() => setLoading(false), 300);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- HANDLERS ---
  const handleAddNewClick = () => {
    setViewMode('add');
  };

  const handleEditClick = (item: HTWToolType) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  const handleViewClick = (item: HTWToolType) => {
    setViewingItem(item);
    setIsViewModalOpen(true);
  };

  const handleToggleStatus = async (item: HTWToolType) => {
    if(!item.id) return;
    try {
      setTogglingId(item.id);
      if (item.is_active) {
        await api.delete(`/htw/tool-types/${item.id}`);
      } else {
        await api.put(`/htw/tool-types/${item.id}`, { ...item, is_active: true });
      }
      setData(prev => prev.map(r => r.id === item.id ? { ...r, is_active: !r.is_active } : r));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this tool type?")) return;
    try {
      setDeletingId(id);
      await api.delete(`/htw/tool-types/${id}`);
      setData(prev => prev.map(r => r.id === id ? { ...r, is_active: false } : r));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (payload: HTWToolType, isEdit: boolean) => {
    setSubmitting(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/htw/tool-types/${editingItem.id}`, payload);
        setIsEditModalOpen(false);
        setEditingItem(null);
      } else {
        await api.post('/htw/tool-types', payload);
        setViewMode('list');
      }
      fetchData();
    } catch (err: any) {
      throw err;
    } finally {
      setSubmitting(false);
    }
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
      <AddToolPage 
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
               <Wrench size={24} className="text-blue-500" />
               HTW Tool Types
             </h3>
             <p className="text-sm text-gray-500">Manage tool categories and classifications</p>
          </div>
        </div>
        <button 
          onClick={handleAddNewClick} 
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm transition-colors"
        >
            <Plus size={16} className="mr-2" /> Add Tool Type
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Table */}
      {loading ? (
        <HTWToolTypeSkeleton />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20">
          {/* Added mb-20 for safe spacing with footer */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                  <th className="px-6 py-4">Tool Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Operation</th>
                  <th className="px-6 py-4">Classification</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {data.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No tool types found.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.tool_name}</td>
                      <td className="px-6 py-4 text-gray-600">{item.tool_category}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.operation_type === 'Indicating' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {item.operation_type === 'Setting' ? <Settings size={12} className="mr-1"/> : <Info size={12} className="mr-1"/>}
                          {item.operation_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-mono text-xs">{item.classification || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={togglingId === item.id}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                            item.is_active 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          } disabled:opacity-50`}
                        >
                          {togglingId === item.id ? (
                             <Loader2 size={12} className="animate-spin mr-1"/>
                          ) : (
                             item.is_active ? <CheckCircle size={12} className="mr-1"/> : <PowerOff size={12} className="mr-1"/>
                          )}
                          {item.is_active ? 'Active' : 'Inactive'}
                        </button>
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

      {/* 2. USED PORTAL FOR VIEW MODAL */}
      {isViewModalOpen && viewingItem && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-fadeIn overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Wrench size={20} className="text-blue-500" />
                Tool Type Details
              </h3>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="text-xs font-semibold text-blue-600 uppercase block mb-1">Tool Name</span>
                <span className="text-lg font-bold text-gray-900">{viewingItem.tool_name}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Category</span>
                  <span className="text-sm text-gray-900">{viewingItem.tool_category}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Operation</span>
                  <span className="text-sm text-gray-900">{viewingItem.operation_type}</span>
                </div>
              </div>

              <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase block mb-1">Classification</span>
                  <span className="text-sm font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded inline-block w-full">
                    {viewingItem.classification || 'N/A'}
                  </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
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
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500">Last Updated:</span>
                   <span className="text-gray-900">{formatDate(viewingItem.updated_at)}</span>
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
        </div>,
        document.body
      )}

      {/* 3. USED PORTAL FOR EDIT MODAL */}
      {isEditModalOpen && editingItem && createPortal(
        <EditToolModal 
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
  onSave: (payload: HTWToolType) => Promise<void>;
  submitting: boolean;
}

const AddToolPage: React.FC<AddPageProps> = ({ onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    tool_name: '',
    tool_category: '',
    operation_type: 'Indicating' as 'Indicating' | 'Setting',
    classification: '',
    is_active: true
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // Fix for checkbox type check
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.tool_name.trim() || !formData.tool_category.trim()) {
      setError("Tool Name and Category are required.");
      return;
    }

    try {
      await onSave({
        tool_name: formData.tool_name,
        tool_category: formData.tool_category,
        operation_type: formData.operation_type,
        classification: formData.classification || undefined,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save tool type.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn mb-20">
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
            Add New Tool Type
          </h3>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm flex items-center">
            <AlertCircle size={16} className="mr-2" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tool Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="tool_name"
              value={formData.tool_name}
              onChange={handleChange}
              required
              placeholder="e.g. Hydraulic torque wrench"
              className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tool Category <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="tool_category"
                  value={formData.tool_category}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Tool Type 1"
                  className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operation Type <span className="text-red-500">*</span></label>
                <select
                  name="operation_type"
                  value={formData.operation_type}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="Indicating">Indicating</option>
                    <option value="Setting">Setting</option>
                </select>
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
            <input
              type="text"
              name="classification"
              value={formData.classification}
              onChange={handleChange}
              placeholder="e.g. Type I Class C (Optional)"
              className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
             <span className="text-sm font-medium text-gray-700">Tool Status</span>
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
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm disabled:opacity-70 transition-all"
            >
              {submitting ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
              Save Tool Type
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
  item: HTWToolType;
  onCancel: () => void;
  onSave: (payload: HTWToolType) => Promise<void>;
  submitting: boolean;
}

const EditToolModal: React.FC<EditModalProps> = ({ item, onCancel, onSave, submitting }) => {
  const [formData, setFormData] = useState({
    tool_name: item.tool_name,
    tool_category: item.tool_category,
    operation_type: item.operation_type,
    classification: item.classification || '',
    is_active: item.is_active
  });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    // Fix for checkbox type check
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.tool_name.trim() || !formData.tool_category.trim()) {
      setError("Tool Name and Category are required.");
      return;
    }

    try {
      await onSave({
        tool_name: formData.tool_name,
        tool_category: formData.tool_category,
        operation_type: formData.operation_type,
        classification: formData.classification || undefined,
        is_active: formData.is_active
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update.");
    }
  };

  return (
    // UPDATED Z-INDEX: z-[9999]
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl animate-fadeIn overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="text-blue-500" size={20} />
            Edit Tool Type
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tool Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="tool_name"
                value={formData.tool_name}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tool Category <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="tool_category"
                    value={formData.tool_category}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Operation Type <span className="text-red-500">*</span></label>
                  <select
                    name="operation_type"
                    value={formData.operation_type}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                      <option value="Indicating">Indicating</option>
                      <option value="Setting">Setting</option>
                  </select>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <input
                type="text"
                name="classification"
                value={formData.classification}
                onChange={handleChange}
                placeholder="e.g. Type I Class C (Optional)"
                className="w-full border border-gray-300 rounded-lg shadow-sm px-4 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 shadow-sm disabled:opacity-70 transition-all"
            >
              {submitting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
              Update Tool Type
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};