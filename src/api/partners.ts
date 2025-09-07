import { supabase } from '../lib/supabase';
import { executeSafeQuery } from '../utils/queryHelpers';

export type PartnerType = 'supplier' | 'customer' | 'both';

export interface Partner {
  id: number;
  partner_code: string;
  name: string;
  partner_type: PartnerType;
  postal_code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
  payment_terms?: number;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getPartners(type?: PartnerType): Promise<Partner[]> {
  let query = supabase
    .from('partners')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (type) {
    query = query.or(`partner_type.eq.${type},partner_type.eq.both`);
  }

  const result = await executeSafeQuery(query, []);
  return result as Partner[];
}

export async function getSuppliers(): Promise<Partner[]> {
  return getPartners('supplier');
}

export async function getCustomers(): Promise<Partner[]> {
  return getPartners('customer');
}
