import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// 担当者の型定義
export interface AssignedUser {
  id: string;
  full_name: string;
  role: string;
  department?: string;
  can_manage_orders: boolean;
  can_manage_inventory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 担当者選択オプションの型
export interface AssignedUserOption {
  value: string;
  label: string;
  description?: string;
  isActive: boolean;
  department?: string;
}

// 発注担当者取得関数
const getAssignedUsers = async (): Promise<AssignedUser[]> => {
  // Fetching assigned users

  // user_profilesテーブル構造に基づいて取得
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      full_name,
      role,
      company_name,
      department,
      position,
      is_active,
      updated_at
    `)
    .eq('is_active', true)
    .order('full_name');

  if (error) {
    console.error('❌ Failed to fetch assigned users:', error);

    // フォールバックとして基本データのみ取得
    const { data: basicData, error: basicError } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, updated_at')
      .eq('is_active', true)
      .order('full_name');

    if (basicError) {
      console.error('❌ Basic fetch also failed:', basicError);
      return [];
    }

    // デフォルト値を設定
    const fallbackData = (basicData || []).map(user => ({
      ...user,
      can_manage_orders: true,
      can_manage_inventory: true,
      is_active: true,
      department: null,
      created_at: user.updated_at,
    }));

    console.warn('⚠️ Using fallback data with default permissions');
    return fallbackData;
  }

  // データを整形して権限フィールドを追加
  const enhancedData = (data || []).map(user => ({
    ...user,
    can_manage_orders: true, // 全てのアクティブユーザーが発注管理可能
    can_manage_inventory: user.role === 'admin' || user.role === 'manager',
    created_at: user.updated_at,
  }));

  // Assigned users fetched
  return enhancedData;
};

// 特定の担当者情報取得
const getAssignedUser = async (userId: string): Promise<AssignedUser | null> => {
  // Fetching assigned user

  // user_profilesテーブル構造に基づいて取得
  const { data, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      full_name,
      role,
      company_name,
      department,
      position,
      is_active,
      updated_at
    `)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn('⚠️ Assigned user not found:', userId);
      return null;
    }

    // フォールバックとして基本データのみ取得
    const { data: basicData, error: basicError } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, updated_at')
      .eq('id', userId)
      .single();

    if (basicError) {
      if (basicError.code === 'PGRST116') {
        console.warn('⚠️ User not found in basic fetch:', userId);
        return null;
      }
      console.error('❌ Failed to fetch assigned user (basic):', basicError);
      return null;
    }

    if (!basicData) return null;

    // デフォルト値を設定
    const fallbackUser = {
      ...basicData,
      can_manage_orders: true,
      can_manage_inventory: true,
      is_active: true,
      department: null,
      created_at: basicData.updated_at,
    };

    console.warn('⚠️ Using fallback user data with default permissions');
    return fallbackUser;
  }

  if (!data) return null;

  // is_activeカラムが存在しないため、デフォルト値を設定
  const enhancedUser = {
    ...data,
    is_active: true,
    created_at: data.updated_at,
  };

  // Assigned user fetched
  return enhancedUser;
};

// 担当者一覧取得カスタムフック
export function useAssignedUsers() {
  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['assigned-users'],
    queryFn: getAssignedUsers,
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });

  // 選択オプション形式に変換
  const userOptions: AssignedUserOption[] = (users || []).map(user => ({
    value: user.id,
    label: user.full_name,
    description: `${user.department || '未設定'} - ${user.role || '担当者'}`,
    isActive: user.is_active,
    department: user.department,
  }));


  // アクティブなユーザーのみ
  const activeUserOptions = userOptions.filter(option => option.isActive);

  return {
    users: users || [],
    userOptions,
    activeUserOptions,
    isLoading,
    error,
    refetch,
  };
}

// 特定の担当者取得カスタムフック
export function useAssignedUser(userId: string | null) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['assigned-user', userId],
    queryFn: () => userId ? getAssignedUser(userId) : Promise.resolve(null),
    enabled: !!userId,
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });

  return {
    user,
    isLoading,
    error,
  };
}

// 現在のユーザー情報取得カスタムフック
export function useCurrentUser() {
  const { data: currentUser, isLoading, error } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // user_profilesテーブル構造に基づいて取得
      let { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select(`
          id,
          full_name,
          role,
          company_name,
          department,
          position,
          is_active,
          updated_at
        `)
        .eq('id', user.id)
        .single();

      if (profileError) {
        // フォールバックとして基本データのみ取得
        const { data: basicProfile, error: basicError } = await supabase
          .from('user_profiles')
          .select('id, full_name, role, updated_at')
          .eq('id', user.id)
          .single();

        if (basicError) {
          throw basicError;
        }

        // デフォルト値を設定
        profile = {
          ...basicProfile,
          can_manage_orders: true,
          can_manage_inventory: basicProfile?.role === 'admin' || basicProfile?.role === 'manager',
          is_active: true,
          company_name: null,
          department: null,
          position: null,
          created_at: basicProfile?.updated_at,
        };

        console.warn('⚠️ Using fallback current user data with default permissions');
      } else if (profile) {
        // 権限フィールドとその他のフィールドを設定
        profile = {
          ...profile,
          can_manage_orders: true,
          can_manage_inventory: profile.role === 'admin' || profile.role === 'manager',
          created_at: profile.updated_at,
        };
      }

      if (!profile) {
        throw new Error('Failed to load user profile');
      }

      return profile as AssignedUser;
    },
    staleTime: 600000, // 10分間キャッシュ
    refetchOnWindowFocus: false,
  });

  return {
    currentUser,
    isLoading,
    error,
    isAuthenticated: !!currentUser,
    canManageOrders: currentUser?.can_manage_orders || false,
    canManageInventory: currentUser?.can_manage_inventory || false,
    isAdmin: currentUser?.role === 'admin',
  };
}

// 担当者権限チェック関数
export const AssignedUserUtils = {
  // 発注権限チェック
  canManageOrders: (user: AssignedUser | null): boolean => {
    return user?.can_manage_orders === true && user?.is_active === true;
  },

  // 在庫権限チェック
  canManageInventory: (user: AssignedUser | null): boolean => {
    return user?.can_manage_inventory === true && user?.is_active === true;
  },

  // 管理者権限チェック
  isAdmin: (user: AssignedUser | null): boolean => {
    return user?.role === 'admin';
  },

  // ユーザー表示名生成
  getDisplayName: (user: AssignedUser | null): string => {
    if (!user) return '未設定';

    const department = user.department ? ` (${user.department})` : '';
    return `${user.full_name}${department}`;
  },

  // ユーザー権限説明
  getPermissionDescription: (user: AssignedUser): string => {
    const permissions = [];

    if (user.role === 'admin') {
      permissions.push('管理者');
    }
    if (user.can_manage_orders) {
      permissions.push('発注管理');
    }
    if (user.can_manage_inventory) {
      permissions.push('在庫管理');
    }

    return permissions.length > 0 ? permissions.join(', ') : '権限なし';
  },

  // バリデーション関数
  validateAssignedUser: (userId: string | null, users: AssignedUser[]): {
    isValid: boolean;
    error?: string;
  } => {
    if (!userId) {
      return {
        isValid: false,
        error: '発注担当者は必須です',
      };
    }

    const user = users.find(u => u.id === userId);
    if (!user) {
      return {
        isValid: false,
        error: '指定された担当者が見つかりません',
      };
    }

    if (!user.is_active) {
      return {
        isValid: false,
        error: '指定された担当者は無効化されています',
      };
    }

    if (!user.can_manage_orders) {
      return {
        isValid: false,
        error: '指定された担当者は発注権限がありません',
      };
    }

    return { isValid: true };
  },
};

// 発注権限管理カスタムフック
export function useOrderPermissions() {
  const { currentUser, isLoading } = useCurrentUser();

  const permissions = {
    canCreateOrders: currentUser?.can_manage_orders === true,
    canEditOrders: currentUser?.can_manage_orders === true,
    canDeleteOrders: currentUser?.role === 'admin',
    canViewAllOrders: currentUser?.can_manage_orders === true || currentUser?.role === 'admin',
    canAssignToOthers: currentUser?.role === 'admin',
  };

  return {
    ...permissions,
    currentUser,
    isLoading,
    hasAnyOrderPermission: Object.values(permissions).some(permission => permission === true),
  };
}

// 発注担当者履歴管理
export function useAssignedUserHistory() {
  const queryClient = useQueryClient();

  // 担当者変更履歴記録
  const recordAssignmentChangeMutation = useMutation({
    mutationFn: async ({
      orderId,
      previousUserId,
      newUserId,
      reason,
    }: {
      orderId: string;
      previousUserId?: string;
      newUserId: string;
      reason?: string;
    }) => {
      console.log('🔄 Recording assignment change:', { orderId, previousUserId, newUserId, reason });

      // 変更履歴をログテーブルに記録（将来の拡張用）
      const changeLog = {
        order_id: orderId,
        change_type: 'assigned_user_change',
        previous_value: previousUserId,
        new_value: newUserId,
        reason: reason || 'Manual assignment change',
        changed_at: new Date().toISOString(),
      };

      console.log('📝 Assignment change logged:', changeLog);
      return changeLog;
    },
    onSuccess: () => {
      // 関連キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-all'] });
    },
  });

  return {
    recordAssignmentChange: recordAssignmentChangeMutation.mutateAsync,
    isRecording: recordAssignmentChangeMutation.isPending,
  };
}