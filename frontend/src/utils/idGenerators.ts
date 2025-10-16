// REMOVED: import { supabase } from '../lib/supabase'; // No longer needed
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

/**
 * Generates a new SRF No in YYNNN format (e.g., 25001).
 * FRONTEND-ONLY VERSION: Uses localStorage to persist the counter instead of a database.
 */
export const generateSRFNo = (): string => {
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString().slice(-2);

  // Use a unique key for each year to automatically reset the counter annually.
  const storageKey = `srf_counter_${yearSuffix}`;
  
  // Get the last number from browser storage, defaulting to 0 if not found.
  const lastNumber = parseInt(localStorage.getItem(storageKey) || '0', 10);
  
  const nextNumber = lastNumber + 1;

  // Save the new number back to storage for the next time.
  localStorage.setItem(storageKey, String(nextNumber));

  // Format the final SRF number string.
  return `${yearSuffix}${String(nextNumber).padStart(3, '0')}`;
};

// --- NO CHANGES TO THE FUNCTIONS BELOW ---

/**
 * Generates a barcode image from a given ID string.
 */
export const generateBarcode = (neplId: string): string => {
  try {
    // Create a canvas element in memory to draw the barcode on.
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, neplId, {
      format: 'CODE128',
      displayValue: false,
      margin: 10,
      width: 2,
      height: 50,
    });
    // Return the barcode as a base64 encoded PNG image.
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to generate barcode:', error);
    return ''; // Return an empty string on failure.
  }
};

/**
 * Generates a QR code image from equipment data.
 */
export const generateQRCode = async (equipmentData: any): Promise<string> => {
  // Stringify the relevant equipment data to be encoded in the QR code.
  const dataString = JSON.stringify({
    nepl_id: equipmentData.nepl_id,
    material_desc: equipmentData.material_desc,
    make: equipmentData.make,
    model: equipmentData.model,
    serial_no: equipmentData.serial_no,
  });

  try {
    // Return the QR code as a base64 encoded PNG image.
    return await QRCode.toDataURL(dataString);
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    return ''; // Return an empty string on failure.
  }
};