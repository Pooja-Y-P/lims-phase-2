import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ENDPOINTS, BACKEND_ROOT_URL } from "../api/config"; // Import BACKEND_ROOT_URL
import { InwardDetail, ViewInwardEquipment } from "../types/inward";
import { Loader2, HardHat, Building, Calendar, Barcode, ArrowLeft, Edit, X } from "lucide-react";
import { StickerSheet } from "./StickerSheet";

export const ViewInward: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inward, setInward] = useState<InwardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStickerSheet, setShowStickerSheet] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [activePhotos, setActivePhotos] = useState<string[]>([]);

  const resolvePhotoUrl = (photo: string) => {
    if (!photo) return "";
    if (/^https?:\/\//i.test(photo)) return photo;
    const normalized = photo.startsWith("/") ? photo : `/${photo}`;
    return `${BACKEND_ROOT_URL}${normalized}`;
  };

  const openImageModal = (photos: string[]) => {
    const resolvedPhotos = photos
      .map(resolvePhotoUrl)
      .filter((url): url is string => Boolean(url));
    setActivePhotos(resolvedPhotos);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setActivePhotos([]);
    setShowImageModal(false);
  };

  useEffect(() => {
    if (!id) return;

    const fetchInward = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get<InwardDetail>(`${ENDPOINTS.STAFF.INWARDS}/${id}`);
        setInward(res.data);
      } catch (error) {
        console.error("Error fetching inward:", error);
        setError("Failed to load inward details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInward();
  }, [id]);

  const handleEditInward = () => {
    navigate(`/engineer/edit-inward/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <p className="p-6 text-center text-red-500 bg-red-50 rounded-lg">{error}</p>
    );
  }

  if (!inward) {
    return (
      <p className="p-6 text-center text-gray-500">No inward details found for this ID.</p>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <button
                onClick={() => navigate('/engineer/view-inward')}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2"
              >
                <ArrowLeft size={16} /> Back to List
              </button>
              <h1 className="text-3xl font-bold text-gray-800">Inward Details</h1>
              <p className="text-lg text-blue-600 font-mono mt-1">{inward.srf_no}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEditInward}
                className="flex items-center gap-2 bg-green-600 text-white font-bold px-5 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Edit size={20} />
                Edit Inward
              </button>
              <button
                onClick={() => setShowStickerSheet(true)}
                className="flex items-center gap-2 bg-slate-700 text-white font-bold px-5 py-3 rounded-lg hover:bg-slate-800 transition-colors"
                disabled={!inward.equipments || inward.equipments.length === 0}
              >
                <Barcode size={20} />
                Print Stickers
              </button>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-t pt-6">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-semibold text-gray-700">{inward.customer_details}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Received Date</p>
                <p className="font-semibold text-gray-700">{new Date(inward.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardHat className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Overall Status</p>
                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 capitalize">
                  {inward.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Equipment List Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200">
          <h2 className="text-xl font-semibold p-4 border-b">Equipment List ({inward.equipments.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-sm font-semibold text-gray-600">NEPL ID</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Description</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Make / Model</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Serial No</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Quantity</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Range</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Image(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {inward.equipments.map((eq: ViewInwardEquipment) => (
                  <tr key={eq.inward_eqp_id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-blue-600">{eq.nepl_id}</td>
                    <td className="p-4 text-gray-800">{eq.material_description}</td>
                    <td className="p-4 text-gray-600">{eq.make} / {eq.model}</td>
                    <td className="p-4 text-gray-500">{eq.serial_no || 'N/A'}</td>
                    <td className="p-4 text-gray-500">{eq.quantity}</td>
                    <td className="p-4 text-gray-500">{eq.range || 'N/A'}</td>
                    <td className="p-4">
                      {eq.photos && eq.photos.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {eq.photos.map((photo, index) => (
                            <button
                              key={`${photo}-${index}`}
                              type="button"
                              className="relative h-16 w-16 overflow-hidden rounded border border-gray-200 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onClick={() => openImageModal(eq.photos ?? [])}
                              title="Click to view full image"
                            >
                              <img
                                src={resolvePhotoUrl(photo)}
                                alt={`Equipment image ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                              <span className="sr-only">View image {index + 1}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Not Available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {showStickerSheet && (
        <StickerSheet 
          equipmentList={inward.equipments} 
          inwardStatus={inward.status}
          onClose={() => setShowStickerSheet(false)} 
        />
      )}

      {/* Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Equipment Images</h3>
              <button onClick={closeImageModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-grow">
              {activePhotos.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {activePhotos.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Equipment attachment ${index + 1}`}
                      className="max-w-full h-auto rounded-md shadow-sm"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600">No images available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
