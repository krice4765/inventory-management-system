import { supabase } from '../lib/supabase';

export interface SystemHealth {
  total_orders: number;
  completed_orders: number;
  active_orders: number;
  total_installments: number;
  confirmed_installments: number;
  draft_installments: number;
  active_staff: number;
  anomaly_count: number;
  last_updated: string;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const { data, error } = await supabase.rpc('get_system_health');

  if (error) throw error;
  
  if (!data || data.length === 0) {
    throw new Error('システムヘルス情報の取得に失敗しました');
  }
  
  return data[0] as SystemHealth;
}