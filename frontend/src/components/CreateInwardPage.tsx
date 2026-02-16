import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileText, Users, Loader2, Trash2, CreditCard as Edit3, 
  AlertCircle, CheckCircle, Clock, Save, Plus, ArrowLeft, X 
} from 'lucide-react';
import { InwardForm } from './InwardForm';
import { api, ENDPOINTS } from '../api/config';

interface AvailableDraft {
  inward_id: number;
  draft_updated_at: string;
  created_at: string;
  customer_details: string;
  draft_data: {
    customer_details?: string;
    customer_dc_date?: string;
    date?: string;
    receiver?: string;
    equipment_list?: any[];
  };
}

// --- Skeleton Component ---
const DraftsSkeleton = () => {
  return (
    <div className="space-y-3 w-full">
      {/* Create 3 skeleton items to simulate a list */}
      {[1, 2, 3].map((item) => (
        <div 
          key={item} 
          className="bg-white rounded-lg p-4 border border-green-100 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-start space-x-3 flex-1 min-w-0">
              {/* Icon Skeleton */}
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0"></div>
              
              <div className="flex-1 min-w-0 space-y-2 py-0.5">
                {/* Title Skeleton */}
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                
                {/* Meta Tags Skeleton */}
                <div className="flex items-center space-x-3">
                  <div className="h-3 bg-gray-100 rounded w-16"></div>
                  <div className="h-3 bg-gray-100 rounded w-20"></div>
                </div>
              </div>
            </div>
            
            {/* Buttons Skeleton */}
            <div className="flex space-x-2 flex-shrink-0 ml-4">
              <div className="h-8 w-20 bg-blue-50 rounded-lg"></div>
              <div className="h-8 w-20 bg-red-50 rounded-lg"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const CreateInwardPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get('draft');
  
  const [drafts, setDrafts] = useState<AvailableDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [draftToDelete, setDraftToDelete] = useState<number | null>(null);

  const dataFetchedRef = useRef(false);

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const showForm = Boolean(draftId) || isCreatingNew;

  useEffect(() => {
    if (!draftId) {
        setIsCreatingNew(false);
    }
  }, [draftId]);

  useEffect(() => {
    if (showForm) return;
    if (dataFetchedRef.current) return;
    
    dataFetchedRef.current = true;
    loadDrafts();
  }, [showForm]); 

  const loadDrafts = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate slight delay to see skeleton (optional, remove in prod)
      // await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await api.get<AvailableDraft[]>(ENDPOINTS.STAFF.DRAFTS);
      setDrafts(response.data || []);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      setError('Failed to load drafts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const promptDelete = (id: number) => {
    setDraftToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (draftToDelete === null) return;
    const id = draftToDelete;
    
    try {
      setDeletingIds(prev => new Set(prev).add(id));
      await api.delete(ENDPOINTS.STAFF.DRAFT_DELETE(id));
      
      dataFetchedRef.current = false; 
      await loadDrafts();
      
      setDraftToDelete(null);
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      setError('Failed to delete draft. Please try again.');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleContinueDraft = (id: number) => {
    setIsCreatingNew(false);
    navigate(`/engineer/create-inward?draft=${id}`);
  };

  const handleStartNew = () => {
    navigate('/engineer/create-inward/form');
    setIsCreatingNew(true);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    return date.toLocaleDateString();
  };

  if (showForm) {
    const initialDraftId = draftId ? Number(draftId) : null;
    return (
      <InwardForm key={draftId || 'new'} initialDraftId={initialDraftId} />
    );
  }

  return (
    <>
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-100 relative">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b pb-4 mb-6 gap-4">
          <div className="flex items-center space-x-4">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Inward Form</h1>
              <p className="text-gray-600 mt-1">Continue from saved drafts or start new</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/engineer')}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold text-sm"
          >
            <ArrowLeft size={18} />
            <span>Back to Portal</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <span className="text-red-800 text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Drafts Section */}
          <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Save className="h-5 w-5 text-green-600" />
                  Continue from Drafts
                </h2>
                <p className="text-sm text-gray-600 mt-1 h-5">
                  {loading ? (
                    <span className="animate-pulse bg-gray-200 rounded h-4 w-32 inline-block"></span>
                  ) : drafts.length > 0 ? (
                    `${drafts.length} auto-saved draft${drafts.length > 1 ? 's' : ''} available`
                  ) : (
                    'No saved drafts found'
                  )}
                </p>
              </div>
            </div>

            {loading ? (
              // SKELETON LOADING STATE
              <div className="max-h-64 overflow-hidden">
                <DraftsSkeleton />
              </div>
            ) : drafts.length === 0 ? (
              // EMPTY STATE
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">No Drafts Available</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Your progress will be auto-saved every 2 seconds as you fill out forms.
                </p>
              </div>
            ) : (
              // LOADED STATE
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {drafts.map((draft) => (
                  <div 
                    key={draft.inward_id} 
                    className="bg-white rounded-lg p-4 border border-green-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg flex-shrink-0">
                          <Save className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm truncate">
                            {draft.draft_data?.customer_details || draft.customer_details || 'Untitled Draft'}
                          </h4>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="flex items-center gap-1 text-xs text-gray-600">
                              <Users className="h-3 w-3" />
                              {draft.draft_data?.equipment_list?.length || 0} items
                            </span>
                            <span className="flex items-center gap-1 text-xs text-gray-600">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(draft.draft_updated_at || draft.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2 flex-shrink-0 ml-2">
                        <button
                          onClick={() => handleContinueDraft(draft.inward_id)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-1"
                        >
                          <Edit3 className="h-3 w-3" />
                          Continue
                        </button>
                        <button
                          onClick={() => promptDelete(draft.inward_id)}
                          disabled={deletingIds.has(draft.inward_id)}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {deletingIds.has(draft.inward_id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-600 bg-green-100 px-3 py-2 rounded-lg">
                <Save className="h-4 w-4 text-green-500" />
                <span className="font-medium">Auto-save System:</span>
                <span>Saves every 2 seconds • No data loss • Resume anytime</span>
              </div>
            </div>
          </div>

          {/* New Form Section - Right Side */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
                <Plus className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Start New Form</h2>
              <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                Create a fresh inward form from scratch. Your progress will be automatically saved as you work.
              </p>
              <button
                onClick={handleStartNew}
                className="w-full flex items-center justify-center space-x-3 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-lg text-lg transition-colors shadow-lg hover:shadow-xl"
              >
                <Plus className="h-6 w-6" />
                <span>Create New Inward Form</span>
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-blue-200">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>Auto-save every 2 seconds</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>Resume from any device</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>No data loss on logout</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal (Unchanged) */}
      {draftToDelete !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
            <div className="p-6 pb-0 flex justify-between items-start">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <button 
                onClick={() => setDraftToDelete(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Draft?</h3>
              <p className="text-gray-600">
                Are you sure you want to delete this draft? This action cannot be undone and all saved data for this entry will be lost.
              </p>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setDraftToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingIds.has(draftToDelete)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 transition-colors flex items-center justify-center gap-2"
              >
                {deletingIds.has(draftToDelete) ? (
                   <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                     <span>Deleting...</span>
                   </>
                ) : (
                  <span>Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};