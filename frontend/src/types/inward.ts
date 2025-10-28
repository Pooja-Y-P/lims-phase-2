// Base equipment interface for creating new equipment
export interface EquipmentDetail {
  nepl_id: string;
  material_desc: string;
  make: string;
  model: string;
  range?: string;
  serial_no?: string;
  qty: number;
  inspe_notes?: string;
  calibration_by: string;
  supplier?: string;
  out_dc?: string;
  in_dc?: string;
  nextage_ref?: string;
  qr_code?: string;
  barcode?: string;
  barcode_image?: string;
  qrcode_image?: string;
  photos?: File[];
  remarks?: string;
}

// Interface for viewing equipment from API response
export interface ViewInwardEquipment {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  range?: string;
  serial_no?: string;
  quantity: number;
  visual_inspection_notes?: string;
  photos?: string[];
  remarks?: string;
  status?: string;
}

// Interface for the main inward form
export interface InwardForm {
  srf_no: string;
  date: string;
  customer_dc_date: string;
  customer_details: string;
  receiver: string;
  status: string;
}

// Interface for inward details from API response
export interface InwardDetail {
  inward_id: number;
  srf_no: number | string;
  date: string;
  customer_dc_date?: string;
  customer_details: string;
  status: string;
  receiver?: string;
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