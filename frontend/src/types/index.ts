export type UserRole = 'admin' | 'engineer' | 'customer';

export interface User {
  user_id: number;
  customer_id: number | null;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  token?: string;
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

export interface Srf {
  srf_id: number;
  inward_id: number;
  nepl_srf_no: string;
  status: 'created' | 'submitted' | 'in-progress' | 'completed' | 'draft';
  created_at: string;
  contact_person: string | null;
}

// Minimal props for dashboard components
export interface DashboardProps {
  onLogout: () => void;
}