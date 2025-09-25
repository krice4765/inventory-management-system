import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// 税表示モードの型定義
export type TaxDisplayMode = 'tax_included' | 'tax_excluded';

// 税表示設定の型
export interface TaxDisplaySetting {
  id: string;
  organization_id?: string;
  user_id?: string;
  setting_type: 'organization' | 'user';
  tax_display_preference: TaxDisplayMode;
  created_at: string;
  updated_at: string;
}

// ローカルストレージキー
const LOCAL_STORAGE_KEY = 'tax_display_preference';
const LOCAL_STORAGE_EXPIRY_KEY = 'tax_display_preference_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間

// ローカルキャッシュ管理クラス
class TaxDisplayCache {
  static get(): TaxDisplayMode | null {
    try {
      const expiry = localStorage.getItem(LOCAL_STORAGE_EXPIRY_KEY);
      if (expiry && Date.now() > parseInt(expiry)) {
        // 期限切れの場合、キャッシュをクリア
        this.clear();
        return null;
      }

      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      return cached as TaxDisplayMode | null;
    } catch (error) {
      console.warn('⚠️ Local cache read error:', error);
      return null;
    }
  }

  static set(preference: TaxDisplayMode): void {
    try {
      const expiry = Date.now() + CACHE_DURATION;
      localStorage.setItem(LOCAL_STORAGE_KEY, preference);
      localStorage.setItem(LOCAL_STORAGE_EXPIRY_KEY, expiry.toString());
    } catch (error) {
      console.warn('⚠️ Local cache write error:', error);
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_EXPIRY_KEY);
    } catch (error) {
      console.warn('⚠️ Local cache clear error:', error);
    }
  }

  static isExpired(): boolean {
    try {
      const expiry = localStorage.getItem(LOCAL_STORAGE_EXPIRY_KEY);
      return !expiry || Date.now() > parseInt(expiry);
    } catch (error) {
      return true;
    }
  }
}

// サーバー側設定取得関数
const getTaxDisplayPreference = async (userId?: string): Promise<TaxDisplayMode> => {

  // PostgreSQL関数を使用してハイブリッド設定を取得
  if (userId) {
    const { data, error } = await supabase.rpc('get_tax_display_preference', {
      user_id: userId
    });

    if (!error && data) {
      return data as TaxDisplayMode;
    }

    console.warn('⚠️ Server preference fetch failed:', error);
  }

  // フォールバック：直接テーブルから取得
  try {
    // まずユーザー個人設定を確認
    if (userId) {
      const { data: userSettings } = await supabase
        .from('tax_display_settings')
        .select('tax_display_preference')
        .eq('user_id', userId)
        .eq('setting_type', 'user')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (userSettings && userSettings.length > 0) {
        return userSettings[0].tax_display_preference as TaxDisplayMode;
      }
    }

    // 組織設定を確認
    const { data: orgSettings } = await supabase
      .from('tax_display_settings')
      .select('tax_display_preference')
      .eq('setting_type', 'organization')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (orgSettings && orgSettings.length > 0) {
      return orgSettings[0].tax_display_preference as TaxDisplayMode;
    }
  } catch (error) {
    console.warn('⚠️ Direct table query failed:', error);
  }

  // デフォルト設定
  return 'tax_included';
};

// ユーザー設定更新関数
const updateUserTaxDisplayPreference = async (
  userId: string,
  preference: TaxDisplayMode
): Promise<TaxDisplaySetting> => {

  // 既存のユーザー設定を確認
  const { data: existingSettings } = await supabase
    .from('tax_display_settings')
    .select('id')
    .eq('user_id', userId)
    .eq('setting_type', 'user')
    .limit(1);

  if (existingSettings && existingSettings.length > 0) {
    // 更新
    const { data, error } = await supabase
      .from('tax_display_settings')
      .update({
        tax_display_preference: preference,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSettings[0].id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // 新規作成
    const { data, error } = await supabase
      .from('tax_display_settings')
      .insert({
        user_id: userId,
        setting_type: 'user',
        tax_display_preference: preference,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

// 税表示設定カスタムフック（ハイブリッド方式）
export function useTaxDisplaySetting() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 現在のユーザー情報を取得
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // サーバー側設定取得
  const { data: serverPreference, isLoading, error } = useQuery({
    queryKey: ['tax-display-preference', currentUser?.id],
    queryFn: () => getTaxDisplayPreference(currentUser?.id),
    enabled: !!currentUser,
    staleTime: 300000, // 5分間キャッシュ
    refetchOnWindowFocus: false,
  });

  // 現在の表示設定を決定（ハイブリッド方式）
  const [localPreference, setLocalPreference] = useState<TaxDisplayMode | null>(
    TaxDisplayCache.get()
  );

  const currentPreference: TaxDisplayMode = localPreference || serverPreference || 'tax_included';

  // ローカル設定更新
  const updateLocalPreference = (preference: TaxDisplayMode) => {
    setLocalPreference(preference);
    TaxDisplayCache.set(preference);
  };

  // サーバー設定更新
  const updateServerPreferenceMutation = useMutation({
    mutationFn: ({ preference }: { preference: TaxDisplayMode }) => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }
      return updateUserTaxDisplayPreference(currentUser.id, preference);
    },
    onSuccess: (data) => {
      // キャッシュを更新
      queryClient.setQueryData(['tax-display-preference', currentUser?.id], data.tax_display_preference);
    },
    onError: (error) => {
      console.error('❌ Server tax display preference update failed:', error);
    },
  });

  // 設定変更関数（ローカル→サーバーの順で更新）
  const updatePreference = async (preference: TaxDisplayMode) => {
    // 1. 即座にローカル設定を更新（レスポンシブ）
    updateLocalPreference(preference);

    // 2. バックグラウンドでサーバー設定を更新
    if (currentUser) {
      try {
        await updateServerPreferenceMutation.mutateAsync({ preference });
      } catch (error) {
        console.warn('⚠️ Server sync failed, keeping local preference:', error);
      }
    }
  };

  // 設定リセット
  const resetPreference = () => {
    TaxDisplayCache.clear();
    setLocalPreference(null);
    queryClient.invalidateQueries({ queryKey: ['tax-display-preference'] });
  };

  // キャッシュ状態
  const cacheInfo = {
    hasLocalCache: !!localPreference,
    hasServerCache: !!serverPreference,
    isExpired: TaxDisplayCache.isExpired(),
    source: localPreference ? 'local' : serverPreference ? 'server' : 'default',
  };

  return {
    // 現在の設定
    currentPreference,
    isLoading,
    error,

    // 設定更新
    updatePreference,
    resetPreference,
    isUpdating: updateServerPreferenceMutation.isPending,

    // キャッシュ情報
    cacheInfo,

    // ユーティリティ
    togglePreference: () => {
      const newPreference = currentPreference === 'tax_included' ? 'tax_excluded' : 'tax_included';
      updatePreference(newPreference);
    },
  };
}

// 組織レベル税表示設定カスタムフック（管理者用）
export function useOrganizationTaxDisplaySetting() {
  const queryClient = useQueryClient();

  const { data: orgSettings, isLoading, error } = useQuery({
    queryKey: ['org-tax-display-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_display_settings')
        .select('*')
        .eq('setting_type', 'organization')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as TaxDisplaySetting[];
    },
    staleTime: 300000, // 5分間キャッシュ
  });

  const updateOrgPreferenceMutation = useMutation({
    mutationFn: async ({ organizationId, preference }: {
      organizationId: string;
      preference: TaxDisplayMode;
    }) => {
      // 既存の組織設定を確認
      const { data: existingSettings } = await supabase
        .from('tax_display_settings')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('setting_type', 'organization')
        .limit(1);

      if (existingSettings && existingSettings.length > 0) {
        // 更新
        const { data, error } = await supabase
          .from('tax_display_settings')
          .update({
            tax_display_preference: preference,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingSettings[0].id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // 新規作成
        const { data, error } = await supabase
          .from('tax_display_settings')
          .insert({
            organization_id: organizationId,
            setting_type: 'organization',
            tax_display_preference: preference,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      // 関連キャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['org-tax-display-settings'] });
      queryClient.invalidateQueries({ queryKey: ['tax-display-preference'] });
    },
  });

  return {
    orgSettings: orgSettings || [],
    isLoading,
    error,
    updateOrgPreference: updateOrgPreferenceMutation.mutateAsync,
    isUpdating: updateOrgPreferenceMutation.isPending,
  };
}

// 税表示ユーティリティ関数
export const TaxDisplayUtils = {
  // 税表示モードのラベル
  getDisplayLabel: (mode: TaxDisplayMode): string => {
    return mode === 'tax_included' ? '税込表示' : '税抜表示';
  },

  // 税表示モードのアイコン
  getDisplayIcon: (mode: TaxDisplayMode): string => {
    return mode === 'tax_included' ? '💴' : '💰';
  },

  // 価格フォーマット（モード考慮）
  formatPrice: (price: number, mode: TaxDisplayMode): string => {
    const suffix = mode === 'tax_included' ? '（税込）' : '（税抜）';
    return `¥${price.toLocaleString()}${suffix}`;
  },

  // 設定ソースの説明
  getSourceDescription: (source: string): string => {
    switch (source) {
      case 'local':
        return 'ローカル設定（一時的）';
      case 'server':
        return 'サーバー設定（永続的）';
      case 'default':
        return 'デフォルト設定';
      default:
        return '不明な設定ソース';
    }
  },
};