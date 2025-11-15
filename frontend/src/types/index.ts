export type UserRole = 'admin' | 'engineer' | 'customer';

export interface User {
  user_id: number;
  customer_id: number | null;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  token?: string;
  refresh_token?: string;
  is_active?: boolean;
}

export interface Customer {
  customer_id: number;
  customer_details: string; // This seems to be the company name
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
}

// src/types.ts
export interface Equipment {
  inward_eqp_id: number;
  nepl_id: string;
  material_description: string;
  make: string;
  model: string;
  range: string;
  serial_no: string;
  quantity: number;
}

export interface Inward {
  inward_id: number;
  customer: {
    customer_id: number;
    customer_details: string;
  };
  equipments: Equipment[];
}

export interface Srf {
  srf_id: number;
  srf_no: number;
  nepl_srf_no: string;
  contact_person: string;
  email: string;
  telephone: string;
  certificate_issue_name: string;
  date: string;
  status: string;
  inward: Inward;
  calibration_frequency?: string | null;
  statement_of_conformity?: boolean;
  turnaround_time?: number;
  remarks?: string | null;
}



// Minimal props for dashboard components
export interface DashboardProps {
  onLogout: () => void;
}