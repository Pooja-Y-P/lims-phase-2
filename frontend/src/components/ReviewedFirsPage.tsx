// import React, { useState, useEffect } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { api } from '../api/config';
// import { Eye, ChevronLeft, Loader2, Edit, AlertTriangle, CheckCircle } from 'lucide-react';

// // Define the shape of the data coming from the '/staff/inwards/reviewed-firs' endpoint
// interface ReviewedInward {
//   inward_id: number;
//   srf_no: string; // CORRECTED: Changed from number to string
//   updated_at: string | null; // Handle cases where updated_at might be null
//   customer: {
//     customer_details: string;
//   } | null; // Handle cases where customer might be null
// }

// export const ReviewedFirsPage: React.FC = () => {
//   const navigate = useNavigate();
//   const [reviewedInwards, setReviewedInwards] = useState<ReviewedInward[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const fetchReviewedFirs = async () => {
//       try {
//         setLoading(true);
//         // Corrected endpoint name to match the router
//         const response = await api.get<ReviewedInward[]>('/staff/inwards/reviewed-firs');
//         setReviewedInwards(response.data);
//       } catch (err) {
//         console.error("Failed to fetch reviewed FIRs:", err);
//         setError("Could not load data. Please try again later.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchReviewedFirs();
//   }, []);

//   const handleUpdateInward = (inwardId: number) => {
//     // Navigate to the standard inward form in edit mode
//     navigate(`/engineer/inward/edit/${inwardId}`);
//   };

//   const renderContent = () => {
//     if (loading) {
//       return (
//         <div className="flex justify-center items-center h-64">
//           <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
//           <span className="ml-4 text-gray-600">Loading Reviewed Reports...</span>
//         </div>
//       );
//     }

//     if (error) {
//       return (
//         <div className="text-center py-8">
//           <div className="bg-red-50 border border-red-200 rounded-lg p-6">
//             <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
//             <p className="text-red-600">{error}</p>
//             <button
//               onClick={() => window.location.reload()}
//               className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700"
//             >
//               Try Again
//             </button>
//           </div>
//         </div>
//       );
//     }

//     if (reviewedInwards.length === 0) {
//       return (
//         <div className="text-center py-16 px-6 bg-gray-50 rounded-lg">
//           <CheckCircle className="mx-auto h-16 w-16 text-green-400 mb-4" />
//           <h3 className="text-xl font-medium text-gray-900 mb-2">All Caught Up!</h3>
//           <p className="text-gray-500 mb-4">
//             There are no First Inspection Reports awaiting your action.
//           </p>
//           <p className="text-sm text-gray-400">
//             Customer reviewed FIRs will appear here when customers submit their feedback.
//           </p>
//         </div>
//       );
//     }

//     return (
//       <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="min-w-full divide-y divide-gray-200">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   SRF No.
//                 </th>
//                 <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Customer
//                 </th>
//                 <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Customer Reviewed On
//                 </th>
//                 <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Status
//                 </th>
//                 <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                   Action
//                 </th>
//               </tr>
//             </thead>
//             <tbody className="bg-white divide-y divide-gray-200">
//               {reviewedInwards.map((inward) => (
//                 <tr key={inward.inward_id} className="hover:bg-gray-50 transition-colors">
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <div className="text-sm font-medium text-gray-900">
//                       {inward.srf_no}
//                     </div>
//                   </td>
//                   <td className="px-6 py-4">
//                     <div className="text-sm text-gray-900 max-w-xs truncate" title={inward.customer?.customer_details}>
//                       {inward.customer?.customer_details || 'N/A'}
//                     </div>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                     {inward.updated_at ? (
//                       <div className="flex flex-col">
//                         <span>{new Date(inward.updated_at).toLocaleDateString()}</span>
//                         <span className="text-xs text-gray-400">
//                           {new Date(inward.updated_at).toLocaleTimeString()}
//                         </span>
//                       </div>
//                     ) : (
//                       'N/A'
//                     )}
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap">
//                     <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
//                       <AlertTriangle className="w-3 h-3 mr-1" />
//                       Awaiting Update
//                     </span>
//                   </td>
//                   <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                     <button
//                       onClick={() => handleUpdateInward(inward.inward_id)}
//                       className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-900 font-semibold transition-colors"
//                     >
//                       <Edit size={16} />
//                       View & Update Inward
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="p-6 md:p-8 bg-white rounded-2xl shadow-lg border border-gray-100">
//       <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-200 pb-5 mb-6">
//         <div>
//           <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
//             <AlertTriangle className="h-8 w-8 text-orange-600" />
//             Customer Reviewed FIRs
//           </h1>
//           <p className="mt-1 text-sm text-gray-600">
//             First Inspection Reports that have received customer feedback and require your attention.
//           </p>
//         </div>
//         <Link 
//           to="/engineer" 
//           className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-semibold text-sm transition-colors"
//         >
//           <ChevronLeft size={18} />
//           Back to Dashboard
//         </Link>
//       </div>

//       {/* Instructions */}
//       <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
//         <div className="flex items-start">
//           <div className="flex-shrink-0">
//             <Eye className="h-5 w-5 text-blue-400 mt-0.5" />
//           </div>
//           <div className="ml-3">
//             <h3 className="text-sm font-medium text-blue-800">What to do next:</h3>
//             <div className="mt-1 text-sm text-blue-700">
//               <ol className="list-decimal list-inside space-y-1">
//                 <li>Click "View & Update Inward" to open the inward form.</li>
//                 <li>Review the customer's remarks for each deviated item.</li>
//                 <li>Update the inward details if necessary.</li>
//                 <li>Submitting the form will automatically change the status from "Customer Reviewed" to "Updated".</li>
//               </ol>
//             </div>
//           </div>
//         </div>
//       </div>
      
//       {renderContent()}
//     </div>
//   );
// };

// export default ReviewedFirsPage;