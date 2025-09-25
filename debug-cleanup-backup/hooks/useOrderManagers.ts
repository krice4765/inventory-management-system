import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { OrderManager } from '../utils/format';
import toast from 'react-hot-toast';

export function useOrderManagers() {
  return useQuery<OrderManager[]>({
    queryKey: ['order-managers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_managers')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      // 🔥 クライアントサイド重複防止（安全網として）
      const uniqueManagers = (data || []).reduce((acc: OrderManager[], current) => {
        const key = `${current.name?.trim().toLowerCase()}|${(current.department || '').trim().toLowerCase()}`;
        const isDuplicate = acc.some(manager => 
          `${manager.name?.trim().toLowerCase()}|${(manager.department || '').trim().toLowerCase()}` === key
        );
        
        if (!isDuplicate) {
          acc.push(current);
        }
        
        return acc;
      }, []);
      
      return uniqueManagers;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateOrderManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (manager: Omit<OrderManager, 'id' | 'created_at' | 'updated_at'>) => {
      // 作成前の重複チェック
      const { data: existingManagers } = await supabase
        .from('order_managers')
        .select('id, name, department')
        .eq('name', manager.name)
        .eq('department', manager.department || '')
        .eq('is_active', true);

      if (existingManagers && existingManagers.length > 0) {
        throw new Error('同じ名前・部署の担当者が既に存在します');
      }

      const { data, error } = await supabase
        .from('order_managers')
        .insert([{
          name: manager.name,
          email: manager.email,
          department: manager.department,
          is_active: true
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('発注担当者を追加しました');
      queryClient.invalidateQueries({ queryKey: ['order-managers'] });
    },
    onError: (error: Error) => {
      console.error('Failed to create order manager:', error);
      toast.error(error.message || '発注担当者の追加に失敗しました');
    }
  });
}