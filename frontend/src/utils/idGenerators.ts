import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
// Import your configured api instance
import { api, ENDPOINTS } from '../api/config';

export const generateBarcode = async (text: string): Promise<string> => {
  const canvas = document.createElement('canvas');
  return new Promise((resolve, reject) => {
    try {
      JsBarcode(canvas, text, {
        format: 'CODE128', displayValue: false, margin: 0, height: 50,
      });
      resolve(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error("Barcode generation failed:", error);
      reject(error);
    }
  });
};

export const generateQRCode = async (text: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H', margin: 1, width: 128,
    });
  } catch (error) {
    console.error("QR Code generation failed:", error);
    throw error;
  }
};

type SRFResponse = { srf_no: string }; // Changed to string to match backend expectation more closely

const generateLocalSRFNo = (): string => {
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString().slice(-2);
  const storageKey = `srf_counter_${yearSuffix}`;
  const lastCommittedNumber = parseInt(localStorage.getItem(storageKey) || '0', 10);
  const nextNumber = lastCommittedNumber + 1;
  return `${yearSuffix}${String(nextNumber).padStart(3, '0')}`;
};

export const generateSRFNo = async (): Promise<string> => {
  try {
    // FIX: Construct the correct endpoint URL by appending to the base 'INWARDS' path.
    const res = await api.get<SRFResponse>(`${ENDPOINTS.STAFF.INWARDS}/next-srf-no`);
    if (!res.data?.srf_no) {
      throw new Error('Invalid response from SRF generate endpoint');
    }
    return String(res.data.srf_no);
  } catch (err) {
    console.warn('Failed to fetch SRF from backend, falling back to local generator:', err);
    return generateLocalSRFNo();
  }
};

export const commitUsedSRFNo = (srfNo: string) => {
    // This function is now effectively a no-op on the client side
    // as the backend handles number generation and consumption.
    // We can keep it for local fallback if needed.
    console.log(`SRF number ${srfNo} used. Backend will handle tracking.`);
};