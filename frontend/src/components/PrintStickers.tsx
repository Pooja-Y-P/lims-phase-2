import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, ENDPOINTS } from "../api/config";
import { InwardDetail } from "../types/inward";
import { Loader2, ArrowLeft } from "lucide-react";
import { StickerSheet } from "./StickerSheet";

export const PrintStickers: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inward, setInward] = useState<InwardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleClose = () => {
    navigate('/engineer/view-inward');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <span className="ml-3 text-lg text-gray-600">Loading inward data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate('/engineer/view-inward')}
            className="mt-4 flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 mx-auto"
          >
            <ArrowLeft size={16} />
            Back to List
          </button>
        </div>
      </div>
    );
  }

  if (!inward) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No inward details found for this ID.</p>
        <button
          onClick={() => navigate('/engineer/view-inward')}
          className="mt-4 flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 mx-auto"
        >
          <ArrowLeft size={16} />
          Back to List
        </button>
      </div>
    );
  }

  if (!inward.equipments || inward.equipments.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">No equipment found for this inward.</p>
          <button
            onClick={() => navigate('/engineer/view-inward')}
            className="mt-4 flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 mx-auto"
          >
            <ArrowLeft size={16} />
            Back to List
          </button>
        </div>
      </div>
    );
  }

  return (
    <StickerSheet
      equipmentList={inward.equipments}
      inwardStatus={inward.status}
      onClose={handleClose}
    />
  );
};