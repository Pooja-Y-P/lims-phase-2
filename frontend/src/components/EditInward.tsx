// import React, { useEffect, useState } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { api } from "../services/api";
// import { ENDPOINTS } from "../api/config";

// const EditInward: React.FC = () => {
//   const { id } = useParams<{ id: string }>();
//   const [status, setStatus] = useState("");
//   const [remarks, setRemarks] = useState("");
//   const navigate = useNavigate();

//   useEffect(() => {
//     const fetchInward = async () => {
//       try {
//         const res = await api.get(`${ENDPOINTS.STAFF.INWARDS}/${id}`);
//         setStatus(res.data.status);
//         setRemarks(res.data.remarks || "");
//       } catch (error) {
//         console.error("Error fetching inward:", error);
//       }
//     };
//     fetchInward();
//   }, [id]);

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     try {
//       await api.put(`${ENDPOINTS.STAFF.INWARDS}/${id}`, { status, remarks });
//       alert("Inward updated successfully!");
//       navigate("/engineer");
//     } catch (error) {
//       console.error("Error updating inward:", error);
//       alert("Failed to update inward.");
//     }
//   };

//   return (
//     <div className="p-6">
//       <h2 className="text-2xl font-semibold mb-4">Edit Inward</h2>
//       <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
//         <div>
//           <label className="block font-medium mb-1">Status</label>
//           <select
//             value={status}
//             onChange={(e) => setStatus(e.target.value)}
//             className="w-full border px-3 py-2 rounded"
//           >
//             <option value="Received">Received</option>
//             <option value="In Progress">In Progress</option>
//             <option value="Completed">Completed</option>
//           </select>
//         </div>

//         <div>
//           <label className="block font-medium mb-1">Remarks</label>
//           <textarea
//             value={remarks}
//             onChange={(e) => setRemarks(e.target.value)}
//             className="w-full border px-3 py-2 rounded"
//           />
//         </div>

//         <button
//           type="submit"
//           className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
//         >
//           Save Changes
//         </button>
//       </form>
//     </div>
//   );
// };

// export default EditInward;
