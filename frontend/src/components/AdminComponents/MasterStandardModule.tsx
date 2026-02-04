import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom'; // 1. Import createPortal
import { api, ENDPOINTS } from '../../api/config';
import { ExportMasterStandardPage } from './ExportMasterStandardPage';

// --- IMPORT MANAGERS (Self-contained components) ---
// Ensure these file paths are correct relative to this file
import { HTWStandardUncertaintyManager } from './HTWStandardUncertaintyForm';
import { HTWPressureGaugeResolutionManager } from './HTWPressureGaugeResolutionForm'; 
import { HTWCoverageFactorManager } from './HTWCoverageFactorManager';
import { HTWTDistributionManager } from './HTWTDistributionManager';
import { HTWUnPGMasterManager } from './HTWUnPGMasterForm';
import { HTWNomenclatureRangeManager } from './HTWNomenclatureRangeForm';
import { HTWManufacturerSpecsManager } from './HTWManufacturerSpecsManager';
import { HTWCMCReferenceManager } from './HTWCMCReferenceManager';
import { HTWToolTypeManager } from './HTWToolTypeManager';
import { HTWMaxValMeasureErrorManager } from './HTWMaxValMeasureErrorManager';

import {
  ShieldCheck, Ruler, Factory, ArrowRightLeft, Activity, Gauge, Sigma,
  ChevronRight, ChevronDown, AlertCircle, ArrowLeft, Download, Plus,
  Search, Loader2, CheckCircle, PowerOff, Eye, Edit, Trash2, X, Save, ZoomIn, Database, Layers, Target,
  FileText, Calendar, LineChart
} from 'lucide-react';

// --- TYPES ---
export interface MasterStandard {
  id?: number;
  nomenclature: string;
  range_min: number | string;
  range_max: number | string;
  range_unit: string;
  manufacturer: string;
  model_serial_no: string;
  traceable_to_lab: string;
  uncertainty: number | string;
  uncertainty_unit: string;
  certificate_no: string;
  calibration_valid_upto: string;
  accuracy_of_master: string;
  resolution: number | string;
  resolution_unit: string;
  created_at?: string;
  is_active: boolean;
}

interface MenuCard {
  id: number;
  title: string;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;
  desc: string;
  viewId: string;
}

// --- MAIN MODULE COMPONENT ---
export const MasterStandardModule: React.FC = () => {
  const [selectedCalibration, setSelectedCalibration] = useState<string>('');
  const [currentView, setCurrentView] = useState<string>('grid');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const calibrationTypes = [
    "Hydraulic Torque Wrench",
    "Pneumatic Torque Wrench",
    "Manual Torque Wrench",
    "Electric Torque Wrench",
    "Pressure Gauge"
  ];

  const menuCards: MenuCard[] = [
    {
      id: 1, title: "Master Standard Details", icon: <ShieldCheck size={24} strokeWidth={2} />,
      colorClass: "bg-blue-600", desc: "Manage core standard identification data", viewId: "master-standard-list"
    },
    {
      // Wired to HTWManufacturerSpecsManager
      id: 2, title: "Manufacturer Specifications", icon: <Factory size={24} strokeWidth={2} />,
      colorClass: "bg-emerald-600", desc: "View and edit OEM specs and limits", viewId: "manufacturer-specs-manager"
    },
    {
      // Wired to HTWStandardUncertaintyManager
      id: 3, title: "Interpolation Ranges", icon: <ArrowRightLeft size={24} strokeWidth={2} />,
      colorClass: "bg-purple-600", desc: "Configure range interpolation logic", viewId: "htw-uncertainty-manager"
    },
    {
      // Wired to HTWNomenclatureRangeManager
      id: 4, title: "Nomenclature Range", icon: <Activity size={24} strokeWidth={2} />,
      colorClass: "bg-orange-500", desc: "Standard Range for Master Selection", viewId: "nomenclature-range-manager"
    },
    {
      // Wired to HTWUnPGMasterManager
      id: 5, title: "Uncertainty of Pressure Gauge", sub: "(Un-PG)", icon: <Gauge size={24} strokeWidth={2} />,
      colorClass: "bg-cyan-500", desc: "Specific pressure gauge uncertainty metrics", viewId: "un-pg-manager"
    },
    {
      // Wired to HTWCoverageFactorManager
      id: 6, title: "Coverage Factor (k)", icon: <Sigma size={24} strokeWidth={2} />,
      colorClass: "bg-rose-600", desc: "Define expansion coefficients and confidence", viewId: "coverage-factor-manager"
    },
    {
      // Wired to HTWTDistributionManager
      id: 7, title: "Student t Table", icon: <LineChart size={24} strokeWidth={2} />,
      colorClass: "bg-teal-600", desc: "t Distribution data", viewId: "t-distribution-manager"
    },
    {
      // Wired to HTWPressureGaugeResolutionManager
      id: 8, title: "Resolution of Pressure Gauge", icon: <ZoomIn size={24} strokeWidth={2} />,
      colorClass: "bg-slate-600", desc: "Define pressure gauge measurement resolution", viewId: "resolution-pg-manager"
    },
    {
      // Wired to HTWCMCReferenceManager
      id: 9, title: "Hydraulic CMC Backup data", icon: <Database size={24} strokeWidth={2} />,
      colorClass: "bg-green-600", desc: "Access and maintain backup data for CMC ", viewId: "cmc-reference-manager"
    },
    {
      // Wired to HTWToolTypeManager
      id: 10, title: "Tool Type", icon: <Layers size={24} strokeWidth={2} />,
      colorClass: "bg-amber-600", desc: "Maintain Tool Classification and Measurement Behaviour", viewId: "tool-type-manager"
    },
    {
      // Wired to HTWMaxValMeasureErrorManager
      id: 11, title: "Max Val of Measurement Error", icon: <Target size={24} strokeWidth={2} />,
      colorClass: "bg-cyan-600", desc: "Maintain Maximum Value of Measurement Error", viewId: "max-val-of-measurement-err-manager"
    }
  ];

  const handleCardClick = (viewId: string) => {
    // Only allow specific modules access for Hydraulic Torque Wrench
    const restrictedViews = [
      'master-standard-list',
      'manufacturer-specs-manager',
      'htw-uncertainty-manager',
      'un-pg-manager',
      'nomenclature-range-manager',
      'resolution-pg-manager',
      't-distribution-manager',
      'tool-type-manager', 
      'cmc-reference-manager',
      'max-val-of-measurement-err-manager'
    ];

    if (restrictedViews.includes(viewId)) {
      if (selectedCalibration !== 'Hydraulic Torque Wrench') {
        alert('This feature is currently only available for Hydraulic Torque Wrench equipment type.');
        return;
      }
    }
    setCurrentView(viewId);
    setSelectedItem(null);
  };

  const handleBackToGrid = () => {
    setCurrentView('grid');
    setSelectedItem(null);
  };

  const handleEditItem = (item: any, formViewId: string) => {
    setSelectedItem(item);
    setCurrentView(formViewId);
  };

  const handleAddNewItem = (formViewId: string) => {
    setSelectedItem(null);
    setCurrentView(formViewId);
  };

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn">
      {/* --- VIEW: GRID (Main Menu) --- */}
      {currentView === 'grid' && (
        <>
          <div className="mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <Ruler size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Select Calibration Type</h3>
                  <p className="text-xs text-gray-500">Choose the equipment type to configure specifications.</p>
                </div>
              </div>

              <div className="relative max-w-xl">
                <select
                  className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 block p-3 pr-10 shadow-sm transition-all cursor-pointer"
                  value={selectedCalibration}
                  onChange={(e) => setSelectedCalibration(e.target.value)}
                >
                  <option value="" disabled>Select Type...</option>
                  {calibrationTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" size={18} />
              </div>
            </div>
          </div>

          {selectedCalibration ? (
            <div className="animate-slideUp">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Configuration Options</h3>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  Active: {selectedCalibration}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card.viewId)}
                    className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start space-x-4 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all relative overflow-hidden"
                  >
                    <div className={`w-12 h-12 rounded-lg ${card.colorClass} flex-shrink-0 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-200`}>
                      {card.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-gray-900 font-bold text-base truncate group-hover:text-blue-600 transition-colors">
                        {card.title}
                      </h4>
                      {card.sub && <span className="text-xs font-medium text-gray-400 block -mt-1 mb-1">{card.sub}</span>}
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors self-center" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-dashed border-gray-300 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Ruler size={32} className="text-gray-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No Standard Selected</h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm">Please select a calibration standard type from the dropdown above.</p>
            </div>
          )}
        </>
      )}

      {/* --- RENDER LOGIC FOR DIFFERENT VIEWS --- */}

      {/* 1. MASTER STANDARD DETAILS (Not Manager-based yet, uses local list/form) */}
      {currentView === 'master-standard-export' && <ExportMasterStandardPage onBack={handleBackToGrid} />}

      {currentView === 'master-standard-list' && (
        <MasterStandardList
          onBack={handleBackToGrid}
          onAddNew={() => handleAddNewItem('master-standard-form')}
          onEdit={(item) => handleEditItem(item, 'master-standard-form')}
          onExportNavigate={() => setCurrentView('master-standard-export')}
        />
      )}

      {currentView === 'master-standard-form' && (
        <MasterStandardForm
          onBack={() => setCurrentView('master-standard-list')}
          initialData={selectedItem}
        />
      )}

      {/* 2. MANUFACTURER SPECS */}
      {currentView === 'manufacturer-specs-manager' && (
        <HTWManufacturerSpecsManager onBack={handleBackToGrid} />
      )}

      {/* 3. INTERPOLATION RANGES (Uncertainty) */}
      {currentView === 'htw-uncertainty-manager' && (
        <HTWStandardUncertaintyManager onBack={handleBackToGrid} />
      )}

      {/* 4. NOMENCLATURE RANGE */}
      {currentView === 'nomenclature-range-manager' && (
        <HTWNomenclatureRangeManager onBack={handleBackToGrid} />
      )}

      {/* 5. UNCERTAINTY PRESSURE GAUGE */}
      {currentView === 'un-pg-manager' && (
        <HTWUnPGMasterManager onBack={handleBackToGrid} />
      )}

      {/* 6. COVERAGE FACTOR */}
      {currentView === 'coverage-factor-manager' && (
        <HTWCoverageFactorManager onBack={handleBackToGrid} />
      )}

      {/* 7. STUDENT T DISTRIBUTION */}
      {currentView === 't-distribution-manager' && (
        <HTWTDistributionManager onBack={handleBackToGrid} />
      )}

      {/* 8. RESOLUTION PRESSURE GAUGE */}
      {currentView === 'resolution-pg-manager' && (
        <HTWPressureGaugeResolutionManager onBack={handleBackToGrid} />
      )}

      {/* 9. CMC Backup */}
      {currentView === 'cmc-reference-manager' && (
        <HTWCMCReferenceManager onBack={handleBackToGrid} />
      )}

      {/* 10. Tool Type */}
      {currentView === 'tool-type-manager' && (
        <HTWToolTypeManager onBack={handleBackToGrid} />
      )}

      {/* 11. Max Val Of Measurement Error */}
      {currentView === 'max-val-of-measurement-err-manager' && (
        <HTWMaxValMeasureErrorManager onBack={handleBackToGrid} />
      )}

    </div>
  );
};


// ============================================================================
// LOCAL SUB-COMPONENTS FOR MASTER STANDARD ONLY
// (Other features delegate to imported Managers)
// ============================================================================

// --- COMPONENT: Master Standard List ---
interface MasterStandardListProps {
  onBack: () => void;
  onAddNew: () => void;
  onEdit: (item: MasterStandard) => void;
  onExportNavigate: () => void;
}

function MasterStandardList({ onBack, onAddNew, onEdit, onExportNavigate }: MasterStandardListProps) {
  const [standards, setStandards] = useState<MasterStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [standardToDelete, setStandardToDelete] = useState<MasterStandard | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [viewingStandard, setViewingStandard] = useState<MasterStandard | null>(null);
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

  const fetchStandards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(ENDPOINTS.HTW_MASTER_STANDARDS.LIST);
      setStandards(response.data || []);
    } catch (err: any) {
      console.error('Error fetching HTW master standards:', err);
      setError(err.response?.data?.detail || 'Failed to load master standards');
      setStandards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStandards();
  }, [fetchStandards]);

  const filteredStandards = standards.filter(standard => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      standard.nomenclature?.toLowerCase().includes(searchLower) ||
      standard.manufacturer?.toLowerCase().includes(searchLower) ||
      standard.model_serial_no?.toLowerCase().includes(searchLower) ||
      standard.certificate_no?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleToggleStatus = async (standard: MasterStandard, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!standard.id) return;

    try {
      setTogglingId(standard.id);
      const newStatus = !standard.is_active;
      await api.patch(ENDPOINTS.HTW_MASTER_STANDARDS.UPDATE_STATUS(standard.id), null, {
        params: { is_active: newStatus }
      });
      setStandards(prev => prev.map(s => s.id === standard.id ? { ...s, is_active: newStatus } : s));
    } catch (err: any) {
      console.error('Error toggling status:', err);
      alert(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleView = (standard: MasterStandard, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingStandard(standard);
    setShowViewModal(true);
  };

  const handleEdit = (standard: MasterStandard, e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(standard);
  };

  const handleDeleteClick = (standard: MasterStandard, e: React.MouseEvent) => {
    e.stopPropagation();
    setStandardToDelete(standard);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!standardToDelete?.id) return;
    try {
      setDeletingId(standardToDelete.id);
      await api.delete(ENDPOINTS.HTW_MASTER_STANDARDS.DELETE(standardToDelete.id));
      setStandards(prev => prev.filter(s => s.id !== standardToDelete.id));
      setShowDeleteModal(false);
      setStandardToDelete(null);
    } catch (err: any) {
      console.error('Error deleting standard:', err);
      alert(err.response?.data?.detail || 'Failed to delete standard');
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
            <h3 className="text-xl font-bold text-gray-900">Master Standard Records</h3>
            <p className="text-sm text-gray-500">View and manage master standards</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-sm"
            />
          </div>
          <button
            onClick={onExportNavigate}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            <Download size={16} className="mr-2" />
            Export to Excel
          </button>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-500">Loading master standards...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20"> 
          {/* Added mb-20 for safe spacing with footer */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nomenclature</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Manufacturer / S.No</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cert. No</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valid Upto</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStandards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? 'No standards match your search.' : 'No standards found. Click "Add New" to create one.'}
                    </td>
                  </tr>
                ) : (
                  filteredStandards.map((item) => {
                    const isToggling = togglingId === item.id;
                    const isDeleting = deletingId === item.id;

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="p-2 bg-gray-100 rounded-lg mr-3 text-gray-500 group-hover:text-blue-600 group-hover:bg-blue-100 transition-colors">
                              <ShieldCheck size={18} />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{item.nomenclature}</p>
                              <p className="text-xs text-gray-500">Range: {item.range_min || 'N/A'} - {item.range_max || 'N/A'} {item.range_unit || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div className="font-medium">{item.manufacturer || 'N/A'}</div>
                          <div className="text-xs text-gray-400">{item.model_serial_no || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600 font-mono">{item.certificate_no || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(item.calibration_valid_upto || '')}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => handleToggleStatus(item, e)}
                            disabled={isToggling}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${item.is_active
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && standardToDelete && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <AlertCircle className="text-red-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Master Standard</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to delete the master standard <strong>"{standardToDelete.nomenclature}"</strong>?
                This will permanently remove the record from the system.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setStandardToDelete(null);
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

      {/* View Details Modal */}
      {showViewModal && viewingStandard && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999]">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <ShieldCheck className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Master Standard Details</h3>
                    <p className="text-sm text-gray-500">View complete information</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingStandard(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nomenclature</label>
                  <p className="text-sm font-medium text-gray-900">{viewingStandard.nomenclature}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturer</label>
                  <p className="text-sm text-gray-900">{viewingStandard.manufacturer || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Model / Serial No</label>
                  <p className="text-sm text-gray-900">{viewingStandard.model_serial_no || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Range</label>
                  <p className="text-sm text-gray-900">
                    {viewingStandard.range_min || 'N/A'} - {viewingStandard.range_max || 'N/A'} {viewingStandard.range_unit || ''}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Uncertainty</label>
                  <p className="text-sm text-gray-900">
                    {viewingStandard.uncertainty || 'N/A'} {viewingStandard.uncertainty_unit || ''}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Accuracy of Master</label>
                  <p className="text-sm text-gray-900">{viewingStandard.accuracy_of_master || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Resolution</label>
                  <p className="text-sm text-gray-900">
                    {viewingStandard.resolution || 'N/A'} {viewingStandard.resolution_unit || ''}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Traceable To Lab</label>
                  <p className="text-sm text-gray-900">{viewingStandard.traceable_to_lab || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Certificate No</label>
                  <p className="text-sm text-gray-900 font-mono">{viewingStandard.certificate_no || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Calibration Valid Upto</label>
                  <p className="text-sm text-gray-900">{formatDate(viewingStandard.calibration_valid_upto || '')}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${viewingStandard.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                    {viewingStandard.is_active ? (
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
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingStandard(null);
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

// --- COMPONENT: Master Standard Form ---
interface MasterStandardFormProps {
  onBack: () => void;
  initialData: MasterStandard | null;
}

function MasterStandardForm({ onBack, initialData }: MasterStandardFormProps) {
  const [formData, setFormData] = useState<Omit<MasterStandard, 'id' | 'created_at'>>(initialData || {
    nomenclature: 'TORQUE_TRANSDUCER',
    range_min: '',
    range_max: '',
    range_unit: '',
    manufacturer: '',
    model_serial_no: '',
    traceable_to_lab: '',
    uncertainty: '',
    uncertainty_unit: '',
    certificate_no: '',
    calibration_valid_upto: '',
    accuracy_of_master: '',
    resolution: '',
    resolution_unit: '',
    is_active: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    let finalValue: string | boolean = type === 'checkbox' ? checked : value;
    if ((name === 'range_unit' || name === 'uncertainty_unit' || name === 'resolution_unit') && typeof value === 'string') {
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
        uncertainty: formData.uncertainty ? parseFloat(String(formData.uncertainty)) : null,
        resolution: formData.resolution ? parseFloat(String(formData.resolution)) : null,
        calibration_valid_upto: formData.calibration_valid_upto || null,
      };

      if (initialData?.id) {
        await api.put(ENDPOINTS.HTW_MASTER_STANDARDS.UPDATE(initialData.id), submitData);
      } else {
        await api.post(ENDPOINTS.HTW_MASTER_STANDARDS.CREATE, submitData);
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (err: any) {
      console.error('Error saving HTW master standard:', err);
      setSubmitError(err.response?.data?.detail || 'Failed to save master standard. Please try again.');
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
            <h3 className="text-xl font-bold text-gray-900">{initialData ? 'Edit Master Standard' : 'New Master Standard'}</h3>
            <p className="text-sm text-gray-500">{initialData ? `Editing ID: ${initialData.id}` : 'Create a new standard identification record'}</p>
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
                <Save size={16} className="mr-2" /> Save Record
              </>
            )}
          </button>
        </div>
      </div>

      {submitSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700 flex items-center">
            <CheckCircle size={16} className="mr-2" />
            Master standard saved successfully!
          </p>
        </div>
      )}

      {submitError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-20">
        <div className="p-6 border-b border-gray-100">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
            <ShieldCheck size={16} className="mr-2 text-blue-600" /> General Identification
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomenclature <span className="text-red-500">*</span></label>
              <div className="relative">
                <input
                  type="text"
                  name="nomenclature"
                  value={formData.nomenclature}
                  onChange={handleChange}
                  list="nomenclature-options"
                  placeholder="Select or type manually"
                  className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                />
                <datalist id="nomenclature-options">
                  <option value="TORQUE_TRANSDUCER">TORQUE_TRANSDUCER</option>
                  <option value="DIGITAL PRESSURE GAUGE">DIGITAL PRESSURE GAUGE</option>
                  <option value="PRESSURE_GAUGE">PRESSURE_GAUGE</option>
                  <option value="HYDRAULIC_WRENCH">HYDRAULIC_WRENCH</option>
                  <option value="TORQUE TRANSDUCER (100 - 1500 Nm )">TORQUE TRANSDUCER (100 - 1500 Nm )</option>
                  <option value="TORQUE TRANSDUCER (1000 - 40000 Nm)">TORQUE TRANSDUCER (1000 - 40000 Nm)</option>
                  <option value="DIGITAL PRESSURE GAUGE 1000 bar">DIGITAL PRESSURE GAUGE 1000 bar</option>
                </datalist>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label><input type="text" name="manufacturer" value={formData.manufacturer} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Model / Serial No</label><input type="text" name="model_serial_no" value={formData.model_serial_no} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Operating Range</label><div className="flex items-center gap-2"><input type="number" name="range_min" value={formData.range_min} onChange={handleChange} placeholder="Min" className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /><span className="text-gray-400 font-bold">-</span><input type="number" name="range_max" value={formData.range_max} onChange={handleChange} placeholder="Max" className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /><div className="w-32"><input type="text" name="range_unit" value={formData.range_unit} onChange={handleChange} placeholder="e.g. Nm, bar" className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block p-2.5" /></div></div></div>
          </div>
        </div>
        <div className="p-6 bg-gray-50/50">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
            <Activity size={16} className="mr-2 text-orange-500" /> Technical Specifications
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Uncertainty</label><div className="flex items-center gap-2"><input type="number" name="uncertainty" value={formData.uncertainty} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /><input type="text" name="uncertainty_unit" value={formData.uncertainty_unit} onChange={handleChange} placeholder="e.g. %, Abs" className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block p-2.5 w-24" /></div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Accuracy of Master</label><input type="text" name="accuracy_of_master" value={formData.accuracy_of_master} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label><div className="flex items-center gap-2"><input type="number" name="resolution" value={formData.resolution} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /><input type="text" name="resolution_unit" value={formData.resolution_unit} onChange={handleChange} placeholder="e.g. Nm, bar" className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block p-2.5 w-20" /></div></div>
            <div className="lg:col-span-3"><label className="block text-sm font-medium text-gray-700 mb-1">Traceable To Lab</label><input type="text" name="traceable_to_lab" value={formData.traceable_to_lab} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5" /></div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-100">
          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
            <FileText size={16} className="mr-2 text-purple-600" /> Certification & Status
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Certificate No</label><div className="relative"><input type="text" name="certificate_no" value={formData.certificate_no} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 pl-9" /><ShieldCheck size={16} className="absolute left-3 top-3 text-gray-400" /></div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Calibration Valid Upto</label><div className="relative"><div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none"><Calendar className="w-4 h-4 text-gray-500" /></div><input type="date" name="calibration_valid_upto" value={formData.calibration_valid_upto} onChange={handleChange} className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full pl-10 p-2.5" /></div><p className="text-xs text-gray-500 mt-1">System will automatically mark status as 'Expired' if date is past.</p></div>
            <div className="flex items-center h-full pt-2"><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span className="ml-3 text-sm font-medium text-gray-900">{formData.is_active ? 'Manual Active Override' : 'Inactive'}</span></label></div>
          </div>
        </div>
      </form>
    </div>
  );
}