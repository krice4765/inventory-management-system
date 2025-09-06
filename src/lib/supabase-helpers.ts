import { supabase } from './supabase';
import type { PostgrestError } from '@supabase/supabase-js';

export interface DbResult<T> {
  data: T | null;
  error: PostgrestError | null;
  success: boolean;
}

export class SupabaseHelper {
  private static handleResult<T>(result: { data: T | null; error: PostgrestError | null }): DbResult<T> {
    return {
      data: result.data,
      error: result.error,
      success: !result.error && result.data !== null
    };
  }

  static products = {
    async list() {
      const result = await supabase
        .from('products')
        .select('*')
        .order('name');
      return this.handleResult(result);
    },

    async getById(id: string) {
      const result = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      return this.handleResult(result);
    },

    async create(product: Omit<Record<string, unknown>, 'id' | 'created_at'>) {
      const result = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      return this.handleResult(result);
    },

    async update(id: string, updates: Partial<Record<string, unknown>>) {
      const result = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      return this.handleResult(result);
    },

    async delete(id: string) {
      const result = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      return this.handleResult(result);
    }
  };

  static orders = {
    async list() {
      const result = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      return this.handleResult(result);
    },

    async getWithItems(orderId: string) {
      const result = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              name,
              product_code
            )
          )
        `)
        .eq('id', orderId)
        .single();
      return this.handleResult(result);
    }
  };

  static inventory = {
    async getMovements() {
      const result = await supabase
        .from('inventory_movements')
        .select(`
          *,
          products (
            name,
            product_code
          )
        `)
        .order('created_at', { ascending: false });
      return this.handleResult(result);
    },

    async addMovement(movement: Omit<Record<string, unknown>, 'id' | 'created_at'>) {
      const result = await supabase
        .from('inventory_movements')
        .insert(movement)
        .select()
        .single();
      return this.handleResult(result);
    }
  };

  static async executeTransaction<T>(operations: () => Promise<T>): Promise<DbResult<T>> {
    try {
      const data = await operations();
      return { data, error: null, success: true };
    } catch (error) {
      return {
        data: null,
        error: error as PostgrestError,
        success: false
      };
    }
  }

  static auth = {
    async getCurrentUser() {
      const { data: { user }, error } = await supabase.auth.getUser();
      return this.handleResult({ data: user, error });
    },

    async signIn(email: string, password: string) {
      const result = await supabase.auth.signInWithPassword({
        email,
        password
      });
      return this.handleResult({ data: result.data.user, error: result.error });
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      return this.handleResult({ data: true, error });
    }
  };
}

export const db = SupabaseHelper;