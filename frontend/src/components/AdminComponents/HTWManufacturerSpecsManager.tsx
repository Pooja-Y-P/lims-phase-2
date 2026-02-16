import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom'; // 1. Import createPortal
import { api, ENDPOINTS } from '../../api/config';
import { 
  Factory, ArrowLeft, Filter, ChevronDown, Search, Plus, 
  Loader2, CheckCircle, PowerOff, Eye, Edit, Trash2, 
  AlertCircle, X, ArrowRightLeft, Gauge, Save 
} from 'lucide-react';

// --- TYPES ---
export interface ManufacturerSpec {
  id?: number;
  make: string;
  model: string;
  range_min: number | string;
  range_max: number | string;
  torque_20: number | string;
  torque_40?: number | string;
  torque_60: number | string;
  torque_80?: number | string;
  torque_100: number | string;
  torque_unit: string;
  pressure_20: number | string;
  pressure_40?: number | string;
  pressure_60: number | string;
  pressure_80?: number | string;
  pressure_100: number | string;
  pressure_unit: string;
  is_active: boolean;
}

interface HTWManufacturerSpecsManagerProps {
  onBack: () => void;
}

// --- SKELETON COMPONENT ---
const ManufacturerSpecSkeleton = () => {
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
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-slate-200 rounded"></div>
                    <div className="h-4 w-20 bg-slate-200 rounded"></div>
                  </div>
                </td>
                <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 w-32 mx-auto bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4"><div className="h-4 w-32 mx-auto bg-slate-200 rounded"></div></td>
                <td className="px-6 py-4 text-center"><div className="h-6 w-16 mx-auto bg-slate-200 rounded-full"></div></td>
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

// --- MAIN MANAGER COMPONENT ---
export const HTWManufacturerSpecsManager: React.FC<HTWManufacturerSpecsManagerProps> = ({ onBack }) => {
  const [currentView, setCurrentView] = useState<'list' | 'form'>('list');
  const [selectedItem, setSelectedItem] = useState<ManufacturerSpec | null>(null);

  const handleAddNew = () => {
    setSelectedItem(null);
    setCurrentView('form');
  };

  const handleEdit = (item: ManufacturerSpec) => {
    setSelectedItem(item);
    setCurrentView('form');
  };

  const handleFormBack = () => {
    setSelectedItem(null);
    setCurrentView('list');
  };

  return (
    <div className="animate-fadeIn">
      {currentView === 'list' && (
        <ManufacturerSpecList 
          onBack={onBack}
          onAddNew={handleAddNew}
          onEdit={handleEdit}
        />
      )}

      {currentView === 'form' && (
        <ManufacturerSpecForm 
          onBack={handleFormBack}
          initialData={selectedItem}
        />
      )}
    </div>
  );
};

// --- SUB-COMPONENT: LIST ---
interface ManufacturerSpecListProps {
  onBack: () => void;
  onAddNew: () => void;
  onEdit: (item: ManufacturerSpec) => void;
}

function ManufacturerSpecList({ onBack, onAddNew, onEdit }: ManufacturerSpecListProps) {
  const [specs, setSpecs] = useState<ManufacturerSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterModel, setFilterModel] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [specToDelete, setSpecToDelete] = useState<ManufacturerSpec | null>(null);
  
  const [togglingId, setTogglingId] = useState<number | null>(null);
  
  const [viewingSpec, setViewingSpec] = useState<ManufacturerSpec | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Handle Scroll Locking
  useEffect(() => {
    if (showDeleteModal || showViewModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showDeleteModal, showViewModal]);


  const fetchSpecs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(ENDPOINTS.HTW_MANUFACTURER_SPECS.LIST);
      setSpecs(response.data || []);
    } catch (err: any) {
      console.error('Error fetching HTW manufacturer specs:', err);
      setError(err.response?.data?.detail || 'Failed to load manufacturer specifications');
      setSpecs([]);
    } finally {
      // Artificial delay for smoother skeleton transition
      setTimeout(() => setLoading(false), 300);
    }
  }, []);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);
  
  const uniqueModels = [...new Set(specs.map(item => item.model))];
  
  const filteredData = specs.filter(item => {
    const matchesModel = filterModel ? item.model === filterModel : true;
    if (!matchesModel) return false;
    
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      item.make?.toLowerCase().includes(searchLower) ||
      item.model?.toLowerCase().includes(searchLower)
    );
  });

  const handleToggleStatus = async (spec: ManufacturerSpec, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!spec.id) return;

    try {
      setTogglingId(spec.id);
      const newStatus = !spec.is_active;
      await api.patch(ENDPOINTS.HTW_MANUFACTURER_SPECS.UPDATE_STATUS(spec.id), null, {
        params: { is_active: newStatus }
      });
      setSpecs(prev => prev.map(s => s.id === spec.id ? { ...s, is_active: newStatus } : s));
    } catch (err: any) {
      console.error('Error toggling status:', err);
      alert(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleView = (spec: ManufacturerSpec, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingSpec(spec);
    setShowViewModal(true);
  };

  const handleEdit = (spec: ManufacturerSpec, e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(spec);
  };

  const handleDeleteClick = (spec: ManufacturerSpec, e: React.MouseEvent) => {
    e.stopPropagation();
    setSpecToDelete(spec);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!specToDelete?.id) return;
    try {
      setDeletingId(specToDelete.id);
      await api.delete(ENDPOINTS.HTW_MANUFACTURER_SPECS.DELETE(specToDelete.id));
      setSpecs(prev => prev.filter(s => s.id !== specToDelete.id));
      setShowDeleteModal(false);
      setSpecToDelete(null);
    } catch (err: any) {
      console.error('Error deleting spec:', err);
      alert(err.response?.data?.detail || 'Failed to delete specification');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm"><ArrowLeft size={20} /></button>
          <div>
             <h3 className="text-xl font-bold text-gray-900">Manufacturer Specifications</h3>
             <p className="text-sm text-gray-500">Manage OEM specs and limits</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
               <select 
                 className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm appearance-none cursor-pointer"
                 value={filterModel}
                 onChange={(e) => setFilterModel(e.target.value)}
               >
                 <option value="">All Models</option>
                 {uniqueModels.map(model => <option key={model} value={model}>{model}</option>)}
               </select>
               <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
               <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
          
          <div className="relative hidden md:block">
               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
               <input 
                 type="text" 
                 placeholder="Search..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 shadow-sm" 
               />
          </div>

          <button onClick={onAddNew} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
            <Plus size={16} className="mr-2" /> Add New
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <ManufacturerSpecSkeleton />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20"> 
          {/* Added mb-20 above to ensure list doesn't get hidden behind footer in normal flow */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Make / Model</th>
                  <th className="px-6 py-4">Range</th>
                  <th className="px-6 py-4 text-center">Torque Values</th>
                  <th className="px-6 py-4 text-center">Pressure Values</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm || filterModel ? 'No specifications match your filters.' : 'No specifications found. Click "Add New" to create one.'}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => {
                    const isToggling = togglingId === item.id;
                    const isDeleting = deletingId === item.id;
                    
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{item.make || 'N/A'}</div>
                          <div className="text-gray-500">{item.model || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-600">
                          {item.range_min || 'N/A'} - {item.range_max || 'N/A'} {item.torque_unit || ''}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-xs space-y-1">
                            <span className="block text-gray-700 font-medium">
                              {item.torque_20 || 'N/A'}
                              {item.torque_40 ? ` / ${item.torque_40}` : ''}
                              {` / ${item.torque_60 || 'N/A'}`}
                              {item.torque_80 ? ` / ${item.torque_80}` : ''}
                              {` / ${item.torque_100 || 'N/A'}`}
                            </span>
                            <span className="block text-gray-400 text-[10px]">{item.torque_unit || ''}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="text-xs space-y-1">
                            <span className="block text-gray-700 font-medium">
                              {item.pressure_20 || 'N/A'}
                              {item.pressure_40 ? ` / ${item.pressure_40}` : ''}
                              {` / ${item.pressure_60 || 'N/A'}`}
                              {item.pressure_80 ? ` / ${item.pressure_80}` : ''}
                              {` / ${item.pressure_100 || 'N/A'}`}
                            </span>
                            <span className="block text-gray-400 text-[10px]">{item.pressure_unit || ''}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={(e) => handleToggleStatus(item, e)}
                            disabled={isToggling}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                              item.is_active 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isToggling ? (
                              <Loader2 size={14} className="mr-1 animate-spin" />
                            ) : item.is_active ? (
                              <CheckCircle size={14} className="mr-1" />
                            ) : (
                              <PowerOff size={14} className="mr-1" />
                            )}
                            {item.is_active ? 'Active' : 'Deactivated'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => handleView(item, e)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={(e) => handleEdit(item, e)}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(item, e)}
                              disabled={isDeleting}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                            >
                              {isDeleting ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. USED PORTAL FOR DELETE MODAL */}
      {showDeleteModal && specToDelete && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Manufacturer Spec</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to delete the specification for <strong>"{specToDelete.make} {specToDelete.model}"</strong>?
                This will permanently remove the record from the system.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSpecToDelete(null);
                  }}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deletingId !== null}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
        </div>,
        document.body
      )}

      {/* 3. USED PORTAL FOR VIEW MODAL */}
      {showViewModal && viewingSpec && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4">
                    <Factory className="text-emerald-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Manufacturer Specification Details</h3>
                    <p className="text-sm text-gray-500">View complete information</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingSpec(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Make / Manufacturer</label>
                  <p className="text-sm font-medium text-gray-900">{viewingSpec.make || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Model Name</label>
                  <p className="text-sm text-gray-900">{viewingSpec.model || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Range</label>
                  <p className="text-sm text-gray-900 font-mono">
                    {viewingSpec.range_min || 'N/A'} - {viewingSpec.range_max || 'N/A'} {viewingSpec.torque_unit || ''}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    viewingSpec.is_active 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {viewingSpec.is_active ? (
                      <>
                        <CheckCircle size={14} className="mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <PowerOff size={14} className="mr-1" />
                        Deactivated
                      </>
                    )}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Torque Values</label>
                  <div className={`grid gap-4 ${viewingSpec.torque_40 || viewingSpec.torque_80 ? 'grid-cols-5' : 'grid-cols-3'}`}>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">@ 20%</label>
                      <p className="text-sm text-gray-900">{viewingSpec.torque_20 || 'N/A'} {viewingSpec.torque_unit || ''}</p>
                    </div>
                    {viewingSpec.torque_40 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">@ 40%</label>
                        <p className="text-sm text-gray-900">{viewingSpec.torque_40} {viewingSpec.torque_unit || ''}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">@ 60%</label>
                      <p className="text-sm text-gray-900">{viewingSpec.torque_60 || 'N/A'} {viewingSpec.torque_unit || ''}</p>
                    </div>
                    {viewingSpec.torque_80 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">@ 80%</label>
                        <p className="text-sm text-gray-900">{viewingSpec.torque_80} {viewingSpec.torque_unit || ''}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">@ 100%</label>
                      <p className="text-sm text-gray-900">{viewingSpec.torque_100 || 'N/A'} {viewingSpec.torque_unit || ''}</p>
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-2">Pressure Values</label>
                  <div className={`grid gap-4 ${viewingSpec.pressure_40 || viewingSpec.pressure_80 ? 'grid-cols-5' : 'grid-cols-3'}`}>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">@ 20%</label>
                      <p className="text-sm text-gray-900">{viewingSpec.pressure_20 || 'N/A'} {viewingSpec.pressure_unit || ''}</p>
                    </div>
                    {viewingSpec.pressure_40 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">@ 40%</label>
                        <p className="text-sm text-gray-900">{viewingSpec.pressure_40} {viewingSpec.pressure_unit || ''}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">@ 60%</label>
                      <p className="text-sm text-gray-900">{viewingSpec.pressure_60 || 'N/A'} {viewingSpec.pressure_unit || ''}</p>
                    </div>
                    {viewingSpec.pressure_80 && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">@ 80%</label>
                        <p className="text-sm text-gray-900">{viewingSpec.pressure_80} {viewingSpec.pressure_unit || ''}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">@ 100%</label>
                      <p className="text-sm text-gray-900">{viewingSpec.pressure_100 || 'N/A'} {viewingSpec.pressure_unit || ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingSpec(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// --- SUB-COMPONENT: FORM ---
interface ManufacturerSpecFormProps {
  onBack: () => void;
  initialData: ManufacturerSpec | null;
}

function ManufacturerSpecForm({ onBack, initialData }: ManufacturerSpecFormProps) {
  const [formData, setFormData] = useState<Omit<ManufacturerSpec, 'id'>>(initialData || {
    make: '',
    model: '',
    range_min: '',
    range_max: '',
    torque_20: '',
    torque_40: '',
    torque_60: '',
    torque_80: '',
    torque_100: '',
    torque_unit: '',
    pressure_20: '',
    pressure_40: '',
    pressure_60: '',
    pressure_80: '',
    pressure_100: '',
    pressure_unit: '',
    is_active: true
  });

  const [showOptionalFields, setShowOptionalFields] = useState(!!(initialData?.torque_40 || initialData?.torque_80 || initialData?.pressure_40 || initialData?.pressure_80));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    let finalValue: string | boolean = type === 'checkbox' ? checked : value;
    if ((name === 'torque_unit' || name === 'pressure_unit') && typeof value === 'string') {
      finalValue = value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
    }
    setFormData(prev => ({
      ...prev,
      [name]: finalValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const submitData = {
        ...formData,
        range_min: formData.range_min ? parseFloat(String(formData.range_min)) : null,
        range_max: formData.range_max ? parseFloat(String(formData.range_max)) : null,
        torque_20: formData.torque_20 ? parseFloat(String(formData.torque_20)) : null,
        torque_40: showOptionalFields && formData.torque_40 ? parseFloat(String(formData.torque_40)) : null,
        torque_60: formData.torque_60 ? parseFloat(String(formData.torque_60)) : null,
        torque_80: showOptionalFields && formData.torque_80 ? parseFloat(String(formData.torque_80)) : null,
        torque_100: formData.torque_100 ? parseFloat(String(formData.torque_100)) : null,
        pressure_20: formData.pressure_20 ? parseFloat(String(formData.pressure_20)) : null,
        pressure_40: showOptionalFields && formData.pressure_40 ? parseFloat(String(formData.pressure_40)) : null,
        pressure_60: formData.pressure_60 ? parseFloat(String(formData.pressure_60)) : null,
        pressure_80: showOptionalFields && formData.pressure_80 ? parseFloat(String(formData.pressure_80)) : null,
        pressure_100: formData.pressure_100 ? parseFloat(String(formData.pressure_100)) : null,
      };

      if (initialData?.id) {
        await api.put(ENDPOINTS.HTW_MANUFACTURER_SPECS.UPDATE(initialData.id), submitData);
      } else {
        await api.post(ENDPOINTS.HTW_MANUFACTURER_SPECS.CREATE, submitData);
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving HTW manufacturer spec:', err);
      setSubmitError(err.response?.data?.detail || 'Failed to save manufacturer specification. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={onBack} className="mr-4 p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 shadow-sm"><ArrowLeft size={20} /></button>
          <div>
             <h3 className="text-xl font-bold text-gray-900">{initialData ? 'Edit Specification' : 'New Specification'}</h3>
             <p className="text-sm text-gray-500">{initialData ? `Editing ID: ${initialData.id}` : 'Create a new manufacturer specification record'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
           <button 
             onClick={onBack} 
             disabled={isSubmitting}
             className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             Cancel
           </button>
           <button 
             onClick={handleSubmit} 
             disabled={isSubmitting}
             className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isSubmitting ? (
               <>
                 <Loader2 size={16} className="mr-2 animate-spin" /> Saving...
               </>
             ) : (
               <>
                 <Save size={16} className="mr-2" /> Save
               </>
             )}
           </button>
        </div>
      </div>

      {submitSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 flex items-center">
            <CheckCircle size={16} className="mr-2" />
            Manufacturer specification saved successfully!
          </p>
        </div>
      )}

      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20"> 
        {/* Added mb-20 to form too just in case it hits footer */}
        {/* Basic Info */}
        <div className="p-6 border-b border-gray-100">
           <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
              <Factory size={16} className="mr-2 text-emerald-600" /> Basic Details
           </h4>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Make / Manufacturer</label>
                 <input type="text" name="make" value={formData.make} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. TORCTECH" />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Model Name</label>
                 <input type="text" name="model" value={formData.model} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 10LC" />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Full Range</label>
                 <div className="flex items-center gap-2">
                    <input type="number" name="range_min" value={formData.range_min} onChange={handleChange} placeholder="Min" className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                    <span className="text-gray-400">-</span>
                    <input type="number" name="range_max" value={formData.range_max} onChange={handleChange} placeholder="Max" className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
                 </div>
              </div>
           </div>
        </div>

        {/* Grouped: Torque Values */}
        <div className="p-6 bg-gray-50/50 border-b border-gray-100">
           <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                  <ArrowRightLeft size={16} className="mr-2 text-blue-600" /> Torque Values
              </h4>
              <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showOptionalFields} 
                    onChange={(e) => setShowOptionalFields(e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">Show 40% & 80%</span>
                </label>
                <input type="text" name="torque_unit" value={formData.torque_unit} onChange={handleChange} placeholder="e.g. Nm, lbf.ft" className="p-2 text-sm border border-gray-300 rounded-md w-28 bg-white" />
              </div>
           </div>
           <div className={`grid grid-cols-1 gap-6 ${showOptionalFields ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Torque @ 20%</label><input type="number" name="torque_20" value={formData.torque_20} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>
              {showOptionalFields && <div><label className="block text-xs font-medium text-gray-500 mb-1">Torque @ 40%</label><input type="number" name="torque_40" value={formData.torque_40 || ''} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>}
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Torque @ 60%</label><input type="number" name="torque_60" value={formData.torque_60} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>
              {showOptionalFields && <div><label className="block text-xs font-medium text-gray-500 mb-1">Torque @ 80%</label><input type="number" name="torque_80" value={formData.torque_80 || ''} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>}
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Torque @ 100%</label><input type="number" name="torque_100" value={formData.torque_100} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>
           </div>
        </div>

        {/* Grouped: Pressure Values */}
        <div className="p-6 border-b border-gray-100">
           <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                  <Gauge size={16} className="mr-2 text-cyan-600" /> Pressure Values
              </h4>
              <input type="text" name="pressure_unit" value={formData.pressure_unit} onChange={handleChange} placeholder="e.g. bar, psi" className="p-2 text-sm border border-gray-300 rounded-md w-28 bg-white" />
           </div>
           <div className={`grid grid-cols-1 gap-6 ${showOptionalFields ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Pressure @ 20%</label><input type="number" name="pressure_20" value={formData.pressure_20} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>
              {showOptionalFields && <div><label className="block text-xs font-medium text-gray-500 mb-1">Pressure @ 40%</label><input type="number" name="pressure_40" value={formData.pressure_40 || ''} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>}
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Pressure @ 60%</label><input type="number" name="pressure_60" value={formData.pressure_60} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>
              {showOptionalFields && <div><label className="block text-xs font-medium text-gray-500 mb-1">Pressure @ 80%</label><input type="number" name="pressure_80" value={formData.pressure_80 || ''} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>}
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Pressure @ 100%</label><input type="number" name="pressure_100" value={formData.pressure_100} onChange={handleChange} className="w-full p-2.5 bg-white border border-gray-300 rounded-lg focus:border-blue-500" /></div>
           </div>
        </div>

        {/* Active Toggle */}
        <div className="p-6 bg-gray-50">
           <label className="relative inline-flex items-center cursor-pointer">
             <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" />
             <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
             <span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Specification is Active' : 'Inactive'}</span>
           </label>
        </div>

      </form>
    </div>
  );
}