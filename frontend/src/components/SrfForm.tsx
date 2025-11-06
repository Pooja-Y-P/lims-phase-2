// import { useEffect, useState } from "react";
// import { useParams } from 'react-router-dom';
// import { useAuth } from '../auth/AuthProvider';
// // Import the centralized api instance and endpoints
// import { api, ENDPOINTS } from "../api/config"; 

// // --- Define Types for the data this component will handle ---
// interface SrfDetails {
//   srf_id: number;
//   srf_no: string;
//   date: string;
//   telephone?: string;
//   contact_person?: string;
//   email?: string;
//   certificate_issue_name?: string;
//   calibration_frequency?: string;
//   specified_frequency?: string;
//   statement_of_conformity?: boolean;
//   ref_iso_is_doc?: boolean;
//   ref_manufacturer_manual?: boolean;
//   ref_customer_requirement?: boolean;
//   turnaround_time?: number;
//   inward_id: number;
// }

// interface InwardDetails {
//   customer_details: string;
// }

// interface EquipmentItem {
//   inward_eqp_id: number;
//   nepl_id: string;
//   material_description: string;
//   make: string;
//   model: string;
//   serial_no: string;
//   quantity: number;
// }

// export const SrfForm = () => {
//   const { srfId } = useParams<{ srfId: string }>();
//   const { user } = useAuth();

//   const [inward, setInward] = useState<InwardDetails | null>(null);
//   const [srf, setSrf] = useState<SrfDetails | null>(null);
//   const [equipments, setEquipments] = useState<EquipmentItem[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const loadSrfData = async (id: string | undefined) => {
//       if (!id) {
//         setError("SRF ID is missing.");
//         setLoading(false);
//         return;
//       }
//       setLoading(true);
//       setError(null);
//       try {
//         // UPDATED: Use the `api` instance and ENDPOINTS
//         const srfResponse = await api.get<SrfDetails>(`${ENDPOINTS.SRFS}${id}`);
//         const srfData = srfResponse.data;
//         srfData.date = srfData.date ? srfData.date.split('T')[0] : '';
//         setSrf(srfData);
  
//         if (srfData.inward_id) {
//           // UPDATED: Assuming the single inward endpoint is based on the INWARDS path
//           const inwardResponse = await api.get<InwardDetails>(`${ENDPOINTS.INWARDS}${srfData.inward_id}`);
//           setInward(inwardResponse.data);
  
//           // UPDATED: Assuming the equipments endpoint is nested under the inward
//           const equipmentsResponse = await api.get<EquipmentItem[]>(`${ENDPOINTS.INWARDS}${srfData.inward_id}/equipments`);
//           setEquipments(equipmentsResponse.data);
//         }
//       } catch (err: any) {
//         console.error("Failed to load SRF data:", err);
//         setError(err.response?.data?.detail || err.message || "An unknown error occurred.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     loadSrfData(srfId);
//   }, [srfId]);

//   const handleSrfChange = (key: keyof SrfDetails, value: any) => {
//     setSrf(prev => (prev ? { ...prev, [key]: value } : null));
//   };
//   const handleInwardChange = (key: keyof InwardDetails, value: any) => {
//     setInward(prev => (prev ? { ...prev, [key]: value } : null));
//   };

//   const handleUpdateSrf = async (newStatus: string) => {
//     if (!srf) return;
//     setLoading(true);
//     setError(null);
//     try {
//       const payload = { ...srf, status: newStatus };
//       // UPDATED: Use the `api` instance and ENDPOINTS
//       await api.put(`${ENDPOINTS.SRFS}${srf.srf_id}`, payload);
//       alert(`SRF has been successfully updated with status: ${newStatus}`);
//     } catch (err: any) {
//       const errorMessage = err.response?.data?.detail || err.message;
//       alert(`Failed to update SRF: ${errorMessage}`);
//       setError(errorMessage);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const isCustomer = user?.role === 'customer';
//   const isEngineer = user?.role === 'engineer';

//   if (loading) return <div className="p-10 text-center">Loading SRF Details...</div>;
//   if (error) return <div className="p-10 text-center text-red-600">Error: {error}</div>;
//   if (!srf) return <div className="p-10 text-center">SRF not found.</div>;

//   return (
//     <div className="bg-white p-6 md:p-8 rounded-lg shadow-md border max-w-6xl mx-auto my-8">
//       <div className="flex justify-between items-start mb-5">
//         <p className="text-xs text-gray-500">Ref: NEPL / {srf.srf_no}</p>
//         <p className="text-sm font-medium border rounded-md px-3 py-1 bg-gray-50">
//           Dated: {new Date(srf.date).toLocaleDateString()}
//         </p>
//       </div>
      
//       <fieldset className="border-2 rounded-lg p-5 mb-6">
//         <legend className="px-2 text-lg font-semibold">Customer Details</legend>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <div><label className="block text-sm font-medium text-gray-600">SRF ID</label><input readOnly value={srf.srf_id || ""} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm bg-gray-100 p-2"/></div>
//           <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-600">Company</label><textarea readOnly={!isEngineer} value={inward?.customer_details || ""} onChange={e => handleInwardChange("customer_details", e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"/></div>
//           <div><label className="block text-sm font-medium text-gray-600">Contact</label><input readOnly={!isEngineer} value={srf.contact_person || ""} onChange={e => handleSrfChange("contact_person", e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"/></div>
//         </div>
//       </fieldset>
      
//       <fieldset className="border-2 rounded-lg p-5 mb-6">
//         <legend className="px-2 text-lg font-semibold">Equipment Details</legend>
//         <div className="overflow-x-auto">
//           <table className="min-w-full divide-y divide-gray-200">
//             <thead className="bg-gray-50">
//               <tr>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">NEPL ID</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Make/Model</th>
//                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial No</th>
//               </tr>
//             </thead>
//             <tbody className="bg-white divide-y divide-gray-200">
//               {equipments.map(eq => (
//                 <tr key={eq.inward_eqp_id}>
//                   <td className="px-6 py-4 whitespace-nowrap">{eq.nepl_id}</td>
//                   <td className="px-6 py-4 whitespace-nowrap">{eq.material_description}</td>
//                   <td className="px-6 py-4 whitespace-nowrap">{`${eq.make} / ${eq.model}`}</td>
//                   <td className="px-6 py-4 whitespace-nowrap">{eq.serial_no}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </fieldset>

//       <div className="flex justify-end gap-4 mt-6">
//         {isCustomer && (
//             <>
//               <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50" disabled={loading} onClick={() => handleUpdateSrf('rejected_by_customer')}>Reject</button>
//               <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50" disabled={loading} onClick={() => handleUpdateSrf('approved_by_customer')}>Approve</button>
//             </>
//         )}
//         {isEngineer && (
//             <>
//               <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50" disabled={loading}>Cancel</button>
//               <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={loading} onClick={() => handleUpdateSrf('inward_completed')}>Complete Inward</button>
//             </>
//         )}
//       </div>
//     </div>
//   );
// };