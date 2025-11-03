// import React, { useState, useEffect } from 'react';
// import { FileText, Users, Loader2, Trash2, Edit3, AlertCircle, CheckCircle, Clock, Save } from 'lucide-react';
// import { api, ENDPOINTS } from '../api/config';

// interface AvailableDraft {
//   draft_id: number;
//   updated_at: string;
//   created_at: string;
//   customer_details: string;
//   equipment_count: number;
//   preview: {
//     customer_details: string;
//     equipment_count: number;
//   };
// }

// interface DraftManagerProps {
//   onLoadDraft: (draftId: number) => void;
//   className?: string;
//   refreshKey: number;
// }

// export const DraftManager: React.FC<DraftManagerProps> = ({ 
//   onLoadDraft, 
//   className = "",
//   refreshKey
// }) => {
//   const [drafts, setDrafts] = useState<AvailableDraft[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

//   useEffect(() => {
//     loadDrafts();
//   }, [refreshKey]);

//   const loadDrafts = async () => {
//     if (drafts.length === 0) {
//       setLoading(true);
//     }
//     setError(null);
//     try {
//       const response = await api.get<AvailableDraft[]>(ENDPOINTS.STAFF.DRAFTS);
//       setDrafts(response.data || []);
//     } catch (error: any) {
//       console.error('Error loading professional drafts:', error);
//       setError('Failed to load drafts. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const deleteDraft = async (draftId: number) => {
//     if (!window.confirm('Are you sure you want to delete this professionally auto-saved draft?')) return;
    
//     try {
//       setDeletingIds(prev => new Set(prev).add(draftId));
//       await api.delete(ENDPOINTS.STAFF.DRAFT_DELETE(draftId));
//       await loadDrafts();
//     } catch (error: any) {
//       console.error('Error deleting draft:', error);
//       setError('Failed to delete draft. Please try again.');
//     } finally {
//       setDeletingIds(prev => {
//         const newSet = new Set(prev);
//         newSet.delete(draftId);
//         return newSet;
//       });
//     }
//   };

//   const cleanupOldDrafts = async () => {
//     try {
//       await api.post(`${ENDPOINTS.STAFF.DRAFTS}/cleanup`, { days_old: 30 });
//       await loadDrafts();
//     } catch (error: any) {
//       console.error('Error cleaning up old drafts:', error);
//       setError('Failed to cleanup old drafts.');
//     }
//   };

//   const formatTimestamp = (timestamp: string) => {
//     const date = new Date(timestamp);
//     const now = new Date();
//     const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
//     if (diffInMinutes < 1) return 'Just now';
//     if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
//     if (diffInMinutes < 1440) {
//       const hours = Math.floor(diffInMinutes / 60);
//       return `${hours} hour${hours > 1 ? 's' : ''} ago`;
//     }
//     return date.toLocaleDateString();
//   };

//   if (loading && drafts.length === 0) {
//     return (
//       <div className={`flex items-center justify-center p-8 ${className}`}>
//         <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
//         <span className="ml-3 text-gray-600">Loading professional drafts...</span>
//       </div>
//     );
//   }

//   return (
//     <div className={`bg-white ${className}`}>
//       <div className="flex items-center justify-between mb-6">
//         <div>
//           <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
//             <Save className="h-5 w-5 text-green-600" />
//             Professional Auto-Saved Drafts
//           </h3>
//           <p className="text-sm text-gray-600 mt-1">
//             {drafts.length > 0 
//               ? `${drafts.length} inward form${drafts.length > 1 ? 's' : ''} auto-saved every 2 seconds`
//               : 'No auto-saved drafts available'
//             }
//           </p>
//         </div>
//         {drafts.length > 0 && (
//           <button
//             onClick={cleanupOldDrafts}
//             className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
//             title="Clean up drafts older than 30 days"
//           >
//             <Trash2 className="h-4 w-4" />
//             Cleanup Old
//           </button>
//         )}
//       </div>

//       {error && (
//         <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
//           <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
//           <span className="text-red-800 text-sm">{error}</span>
//           <button
//             onClick={() => setError(null)}
//             className="ml-auto text-red-600 hover:text-red-800"
//           >
//             ×
//           </button>
//         </div>
//       )}

//       {drafts.length === 0 && !loading ? (
//         <div className="text-center py-12">
//           <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
//           <h3 className="text-lg font-medium text-gray-900 mb-2">No Professional Drafts Found</h3>
//           <p className="text-gray-500 max-w-md mx-auto">
//             Your progress is professionally auto-saved every 2 seconds as you fill out forms. 
//             Drafts will appear here so you can resume your work anytime without data loss.
//           </p>
//         </div>
//       ) : (
//         <div className="space-y-3 max-h-80 overflow-y-auto">
//           {drafts.map((draft) => (
//             <div 
//               key={draft.draft_id} 
//               className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
//             >
//               <div className="flex items-center justify-between">
//                 <div className="flex items-start space-x-3 flex-1">
//                   <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg flex-shrink-0">
//                     <Save className="h-5 w-5 text-green-600" />
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <h4 className="font-medium text-gray-900 text-sm truncate">
//                       {draft.customer_details || 'Untitled Professional Draft'}
//                     </h4>
//                     <div className="flex items-center space-x-4 mt-1">
//                       <span className="flex items-center gap-1 text-xs text-gray-600">
//                         <Users className="h-3 w-3" />
//                         {draft.equipment_count} item{draft.equipment_count !== 1 ? 's' : ''}
//                       </span>
//                       <span className="flex items-center gap-1 text-xs text-gray-600">
//                         <Clock className="h-3 w-3" />
//                         {formatTimestamp(draft.updated_at)}
//                       </span>
//                       <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
//                         <CheckCircle className="h-3 w-3" />
//                         Auto-saved
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//                 <div className="flex space-x-2 flex-shrink-0">
//                   <button
//                     onClick={() => onLoadDraft(draft.draft_id)}
//                     className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-1"
//                   >
//                     <Edit3 className="h-3 w-3" />
//                     Continue
//                   </button>
//                   <button
//                     onClick={() => deleteDraft(draft.draft_id)}
//                     disabled={deletingIds.has(draft.draft_id)}
//                     className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
//                   >
//                     {deletingIds.has(draft.draft_id) ? (
//                       <Loader2 className="h-3 w-3 animate-spin" />
//                     ) : (
//                       <Trash2 className="h-3 w-3" />
//                     )}
//                     Delete
//                   </button>
//                 </div>
//               </div>
//             </div>
//           ))}
//         </div>
//       )}

//       <div className="mt-4 pt-4 border-t border-gray-200">
//         <div className="flex items-center gap-2 text-xs text-gray-600 bg-green-50 px-3 py-2 rounded-lg">
//           <Save className="h-4 w-4 text-green-500" />
//           <span className="font-medium">Professional System:</span>
//           <span>Auto-save every 2 seconds • No data loss • Logout safe • Resume anytime</span>
//         </div>
//       </div>
//     </div>
//   );
// };