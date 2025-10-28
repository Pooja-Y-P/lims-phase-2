// src/components/StickerSheet.tsx

import React, { useEffect, useState } from 'react';
import { generateBarcode, generateQRCode } from '../utils/idGenerators';
// --- THIS IS THE FIX: Import the correct types ---
import { ViewInwardEquipment, StickerData } from '../types/inward';
import { Loader2, Printer, X } from 'lucide-react';

interface StickerSheetProps {
  equipmentList: ViewInwardEquipment[]; // <-- Use the correct type here
  inwardStatus: string;
  onClose: () => void;
}

export const StickerSheet: React.FC<StickerSheetProps> = ({ equipmentList, inwardStatus, onClose }) => {
  const [stickers, setStickers] = useState<StickerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateAllStickers = async () => {
      setIsLoading(true);
      
      const status_qrcode_image = await generateQRCode(inwardStatus);

      const generatedStickers = await Promise.all(
        // --- THIS IS THE FIX: Use the correct type for `equipment` ---
        equipmentList.map(async (equipment: ViewInwardEquipment) => {
          const barcode_image = await generateBarcode(equipment.nepl_id);
          return { ...equipment, barcode_image, status_qrcode_image };
        })
      );
      setStickers(generatedStickers);
      setIsLoading(false);
    };

    generateAllStickers();
  }, [equipmentList, inwardStatus]);

  return (
    <div className="fixed inset-0 z-[100] bg-white p-6 overflow-auto print:p-2">
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h2 className="text-2xl font-bold">Printable Sticker Sheet</h2>
        <div className="flex items-center space-x-4">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg">
            <Printer size={20} /> Print
          </button>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full">
            <X size={24} />
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-full pt-20">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="ml-4 text-lg">Generating Stickers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:grid-cols-3 print:gap-1">
          {stickers.map((sticker) => (
            <div key={sticker.inward_eqp_id} className="border border-gray-400 rounded-lg p-2 text-center text-xs break-inside-avoid flex flex-col items-center justify-around aspect-video">
              <p className="font-bold text-sm w-full truncate">{sticker.nepl_id}</p>
              {sticker.barcode_image && <img src={sticker.barcode_image} alt="Barcode" className="mx-auto h-10 w-full object-contain my-1" />}
              <div className="flex items-center justify-center gap-2 mt-1">
                {sticker.status_qrcode_image && <img src={sticker.status_qrcode_image} alt="Status QR Code" className="mx-auto w-16 h-16" />}
                <div className="text-left">
                    <p className='font-semibold'>Status:</p>
                    <p className='font-bold text-base'>{inwardStatus}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};