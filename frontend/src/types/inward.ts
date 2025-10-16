// src/types/inward.ts

export interface EquipmentDetail {
  nepl_id: string;
  material_desc: string;
  make: string;
  model: string;
  range: string;
  serial_no: string;
  qty: number;
  inspe_notes: string;
  calibration_by: 'In Lab' | 'Outsource' | 'Out Lab';
  nextage_ref: string;
  barcode?: string;
  qr_code?: string;
  supplier?: string;
  in_dc?: string;
  out_dc?: string;
  photos?: File[];
}

export interface InwardForm {
  srf_no: string;
  date: string;
  customer_dc_date: string;
  receiver: string;
  customer_details: string;
  // contact_person and contact_phone have been REMOVED
}