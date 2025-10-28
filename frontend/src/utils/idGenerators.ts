// src/utils/idGenerators.ts

import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

// --- SRF No Generation (Unchanged) ---
export const generateSRFNo = (): string => {
  const currentYear = new Date().getFullYear();
  const yearSuffix = currentYear.toString().slice(-2);
  const storageKey = `srf_counter_${yearSuffix}`;
  const lastCommittedNumber = parseInt(localStorage.getItem(storageKey) || '0', 10);
  const nextNumber = lastCommittedNumber + 1;
  return `${yearSuffix}${String(nextNumber).padStart(3, '0')}`;
};

export const commitUsedSRFNo = (srfNo: string) => {
  if (!srfNo || srfNo.length < 5) return;
  const yearSuffix = srfNo.slice(0, 2);
  const committedNumber = parseInt(srfNo.slice(2), 10);
  const storageKey = `srf_counter_${yearSuffix}`;
  const lastStoredNumber = parseInt(localStorage.getItem(storageKey) || '0', 10);
  if (committedNumber > lastStoredNumber) {
    localStorage.setItem(storageKey, String(committedNumber));
  }
};

/**
 * Generates a standard 1D barcode image containing the given ID string.
 */
export const generateBarcode = async (idToEncode: string): Promise<string> => {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, idToEncode, {
      format: 'CODE128',
      displayValue: false, // The human-readable value will be printed on the sticker separately
      margin: 10,
      width: 2,
      height: 50,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Failed to generate 1D barcode:', error);
    return '';
  }
};

/**
 * Generates a QR code image from any given string (like a status or an ID).
 */
export const generateQRCode = async (dataToEncode: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(dataToEncode, { errorCorrectionLevel: 'M', width: 200 });
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    return '';
  }
};