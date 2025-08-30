import { supabase } from '../lib/supabase';

export type MovementType = 'purchase' | 'sale' | 'adjustment_in' | 'adjustment_out';

export interface InventoryMovement {
  id: number;
  product_id: number;
  movement_type: MovementType;
  quantity_delta: number; // 入庫：正数、出庫：負数
  unit_price: number;
  note: string | null;
  created_at: string;
  user_id: string | null;
  products?: {
    id: number;
    name: string;
    product_code: string;
    stock_quantity: number;
  };
}

export interface MovementInsert {
  product_id: number;
  movement_type: MovementType;
  quantity_delta: number;
  unit_price: number;
  note?: string | null;
}

export async function getInventoryMovements(limit = 50): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select(`
      id,
      product_id,
      movement_type,
      quantity_delta,
      unit_price,
      note,
      created_at,
      user_id,
      products:product_id (
        id,
        name,
        product_code,
        stock_quantity
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as InventoryMovement[];
}

export async function createInventoryMovement(payload: MovementInsert): Promise<InventoryMovement> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .insert(payload)
    .select(`
      id,
      product_id,
      movement_type,
      quantity_delta,
      unit_price,
      note,
      created_at,
      user_id,
      products:product_id (
        id,
        name,
        product_code,
        stock_quantity
      )
    `)
    .single();

  if (error) throw error;
  return data as InventoryMovement;
}

export async function deleteInventoryMovement(id: number): Promise<void> {
  const { error } = await supabase
    .from('inventory_movements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}