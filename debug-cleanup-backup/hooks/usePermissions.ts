import { useState, useEffect } from 'react';
import type { UserPermissions, InventoryOverrideRequest } from '../types/permissions';
import { PERMISSION_LEVELS } from '../types/permissions';
import { supabase } from '../lib/supabase';

// 現在のユーザー権限を管理するHook
export function useUserPermissions() {
  const [permissions, setPermissions] = useState<UserPermissions>(PERMISSION_LEVELS.OPERATOR);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = async () => {
    try {
      // 実際の実装では、ユーザーIDに基づいて権限を取得
      // 現在はデモ用にADMIN権限を設定
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // TODO: 実際のユーザー権限テーブルから取得
        // const { data: userRole } = await supabase
        //   .from('user_roles')
        //   .select('role')
        //   .eq('user_id', user.id)
        //   .single();

        // デモ用: 管理者権限を付与
        setPermissions(PERMISSION_LEVELS.ADMIN);
      }
    } catch (error) {
      console.error('権限取得エラー:', error);
      setPermissions(PERMISSION_LEVELS.OPERATOR);
    } finally {
      setLoading(false);
    }
  };

  return { permissions, loading, refreshPermissions: loadUserPermissions };
}

// 在庫制限オーバーライド管理Hook
export function useInventoryOverride() {
  const { permissions } = useUserPermissions();

  const requestInventoryOverride = async (request: InventoryOverrideRequest): Promise<boolean> => {
    if (!permissions.canOverrideInventoryLimits) {
      throw new Error('在庫制限をオーバーライドする権限がありません');
    }

    try {
      // 在庫オーバーライド要求をログに記録
      const { error } = await supabase
        .from('inventory_override_logs')
        .insert({
          order_id: request.orderId,
          product_id: request.productId,
          requested_quantity: request.requestedQuantity,
          current_stock: request.currentStock,
          shortage: request.shortage,
          reason: request.reason,
          requested_by: request.requestedBy,
          timestamp: request.timestamp.toISOString(),
          status: 'approved'
        });

      if (error) {
        console.error('オーバーライドログ記録エラー:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('在庫オーバーライド処理エラー:', error);
      return false;
    }
  };

  const canOverrideInventory = permissions.canOverrideInventoryLimits;

  return {
    canOverrideInventory,
    requestInventoryOverride,
  };
}