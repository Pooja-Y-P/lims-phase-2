// src/types/inward.ts

// Base equipment interface for creating new equipment
export interface EquipmentDetail {
  nepl_id: string;
  material_desc: string;
  make: string;
  model: string;
  range?: string;
  serial_no?: string;
  qty: number;
  
  // FIX: Allowing null to match backend data and prevent type errors
  inspe_notes?: string | null; 
  
  calibration_by: 'In Lab' | 'Outsource' | 'Out Lab'; // Keep this specific for form logic
  supplier?: string;
  out_dc?: string;
  in_dc?: string;
  nextage_ref?: string;
  qr_code?: string;
  barcode?: string;
  barcode_image?: string;
  qrcode_image?: string;
  photos?: File[];
  photoPreviews?: string[];
  existingPhotoUrls?: string[];
  
  // This field holds the customer's feedback
  remarks_and_decision?: string | null;
}

// Interface for viewing equipment from the API response
export interface ViewInwardEquipment {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  range?: string;
  serial_no?: string;
  quantity: number;
  visual_inspection_notes?: string | null;
  photos?: string[];
  calibration_by?: string;
  supplier?: string;
  out_dc?: string;
  in_dc?: string;
  nextage_contract_reference?: string;
  qr_code?: string;
  barcode?: string;
  status?: string;

  // FIX: Changed 'remarks' to 'remarks_and_decision' and allowed null
  customer_remarks?: string | null;
  engineer_remarks?: string | null;
}

// Interface for the main inward form's top-level data
export interface InwardForm {
  srf_no: string;
  material_inward_date: string;
  customer_dc_date: string;
  customer_id: number | null; // Added customer_id
  customer_details: string; // Kept for display purposes
  receiver: string;
  status: string;
}

// Interface for the full inward object from the API
export interface InwardDetail {
  inward_id: number;
  srf_no: number | string;
  material_inward_date: string;
  customer_dc_date?: string;
  customer_dc_no?: string;
  customer_id: number; // Added customer_id
  customer_details: string;
  status: string;
  receiver?: string;
  
  // This now uses the corrected ViewInwardEquipment type
  equipments: ViewInwardEquipment[];
}

// Interface for sticker data used in printing
export interface StickerData extends ViewInwardEquipment {
  barcode_image?: string;
  status_qrcode_image?: string;
}

// Interface for inward list response
export interface InwardListResponse {
  inwards: InwardDetail[];
  total: number;
  page: number;
  limit: number;
}
