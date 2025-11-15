import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { EquipmentDetail } from '../types/inward';
import { BACKEND_ROOT_URL } from '../api/config';

interface EquipmentDetailsModalProps {
  equipment: EquipmentDetail;
  onClose: () => void;
}

export const EquipmentDetailsModal: React.FC<EquipmentDetailsModalProps> = ({ equipment, onClose }) => {
  const existingPhotoUrls = useMemo(() => {
    if (!equipment.existingPhotoUrls || equipment.existingPhotoUrls.length === 0) {
      return [];
    }
    return equipment.existingPhotoUrls
      .map((photo) => {
        if (!photo) return '';
        const sanitized = photo.replace(/\\/g, '/');
        if (/^https?:\/\//i.test(sanitized)) return sanitized;
        const normalized = sanitized.startsWith('/') ? sanitized : `/${sanitized}`;
        return `${BACKEND_ROOT_URL}${normalized}`;
      })
      .filter(Boolean);
  }, [equipment.existingPhotoUrls]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-2xl font-semibold">Equipment Details</h2>
          <button
            onClick={onClose}
            className="hover:bg-blue-800 rounded-full p-2 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">NEPL ID</label>
              <div className="text-lg font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded">
                {equipment.nepl_id}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Calibration By</label>
              <div className="text-lg font-medium text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.calibration_by}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Material Description</label>
              <div className="text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.material_desc}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Make</label>
              <div className="text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.make}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Model</label>
              <div className="text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.model}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Range</label>
              <div className="text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.range || 'N/A'}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Serial No</label>
              <div className="text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.serial_no || 'N/A'}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Quantity</label>
              <div className="text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.qty}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Nextage Ref.</label>
              <div className="text-gray-800 bg-gray-50 px-4 py-2 rounded">
                {equipment.nextage_ref || 'N/A'}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Inspection Notes</label>
            <div className="text-gray-800 bg-gray-50 px-4 py-3 rounded whitespace-pre-wrap min-h-[100px]">
              {equipment.inspe_notes || 'No notes provided'}
            </div>
          </div>

          {(equipment.barcode || equipment.qr_code) && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Generated Codes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {equipment.barcode && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Barcode</label>
                    <div className="text-2xl font-mono text-center bg-gray-50 px-4 py-6 rounded border-2 border-dashed border-gray-300">
                      {equipment.barcode}
                    </div>
                  </div>
                )}
                {equipment.qr_code && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-600 uppercase tracking-wide">QR Code Data</label>
                    <div className="text-xs font-mono text-gray-700 bg-gray-50 px-4 py-6 rounded border-2 border-dashed border-gray-300 break-all">
                      {equipment.qr_code}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {existingPhotoUrls.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Existing Photos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {existingPhotoUrls.map((url, index) => (
                  <div key={index} className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                    <img
                      src={url}
                      alt={`Existing equipment photo ${index + 1}`}
                      className="w-full h-48 object-cover bg-gray-100"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {equipment.photoPreviews && equipment.photoPreviews.length > 0 && (
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Attached Photos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {equipment.photoPreviews.map((preview, index) => (
                  <div key={index} className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                    <img
                      src={preview}
                      alt={`Equipment photo preview ${index + 1}`}
                      className="w-full h-48 object-cover bg-gray-100"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">These previews reflect the files you have attached and will be uploaded when the form is submitted.</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-lg border-t">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
