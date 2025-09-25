import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// UUID判定ヘルパー関数
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// 送料設定の型定義
export interface ShippingCostSetting {
  id: string;
  supplier_id: number | null; // bigint型に対応（データベース実装に合わせる）
  shipping_method: 'standard' | 'express' | 'overnight' | 'pickup';
  base_cost: number;
  weight_threshold?: number;
  additional_cost_per_kg?: number;
  free_shipping_threshold?: number;
  tax_rate: number;
  is_active: boolean;
  effective_from: string;
  effective_until?: string;
  created_at: string;
  updated_at: string;
}

// 送料計算リクエストの型
export interface ShippingCostRequest {
  supplier_id: number | null; // UUID文字列を数値IDに変換して使用
  total_weight?: number;
  order_value?: number;
  shipping_method?: string;
  destination_prefecture?: string;
}

// 送料計算レスポンスの型
export interface ShippingCostResponse {
  base_cost: number;
  weight_based_cost: number;
  total_cost: number;
  tax_amount: number;
  total_with_tax: number;
  is_free_shipping: boolean;
  shipping_method: string;
  calculation_details: {
    weight_threshold_exceeded: boolean;
    free_shipping_applied: boolean;
    effective_tax_rate: number;
  };
}

// 送料計算エンジン
export class ShippingCostCalculator {
  static calculateShippingCost(
    setting: ShippingCostSetting,
    request: ShippingCostRequest
  ): ShippingCostResponse {
    console.log('🚚 Calculating shipping cost:', { setting, request });

    let base_cost = setting.base_cost;
    let weight_based_cost = 0;
    let total_cost = base_cost;

    // 重量ベース追加料金の計算
    if (
      request.total_weight &&
      setting.weight_threshold &&
      setting.additional_cost_per_kg &&
      request.total_weight > setting.weight_threshold
    ) {
      const excess_weight = request.total_weight - setting.weight_threshold;
      weight_based_cost = excess_weight * setting.additional_cost_per_kg;
      total_cost += weight_based_cost;
    }

    // 送料無料判定
    const is_free_shipping = !!(
      setting.free_shipping_threshold &&
      request.order_value &&
      request.order_value >= setting.free_shipping_threshold
    );

    if (is_free_shipping) {
      total_cost = 0;
      base_cost = 0;
      weight_based_cost = 0;
    }

    // 税額計算
    const tax_amount = Math.floor(total_cost * setting.tax_rate);
    const total_with_tax = total_cost + tax_amount;

    const result: ShippingCostResponse = {
      base_cost,
      weight_based_cost,
      total_cost,
      tax_amount,
      total_with_tax,
      is_free_shipping,
      shipping_method: setting.shipping_method,
      calculation_details: {
        weight_threshold_exceeded: !!(
          request.total_weight &&
          setting.weight_threshold &&
          request.total_weight > setting.weight_threshold
        ),
        free_shipping_applied: is_free_shipping,
        effective_tax_rate: setting.tax_rate,
      },
    };

    console.log('✅ Shipping cost calculated:', result);
    return result;
  }
}

// 取引先の送料設定取得
const getSupplierShippingSettings = async (supplierId: number): Promise<ShippingCostSetting[]> => {
  console.log('🔄 Fetching shipping settings for supplier:', supplierId);

  if (!supplierId) {
    console.warn('⚠️ No supplier ID provided, using default settings');
    return [];
  }

  const { data, error } = await supabase
    .from('shipping_cost_settings')
    .select('*')
    .eq('supplier_id', supplierId)
    .eq('is_active', true)
    .gte('effective_until', new Date().toISOString())
    .order('effective_from', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch shipping settings:', error);
    throw error;
  }

  console.log('✅ Shipping settings fetched:', data?.length || 0);
  return data || [];
};

// デフォルト送料設定取得
const getDefaultShippingSettings = async (): Promise<ShippingCostSetting[]> => {
  console.log('🔄 Fetching default shipping settings');

  const { data, error } = await supabase
    .from('shipping_cost_settings')
    .select('*')
    .is('supplier_id', null)
    .eq('is_active', true)
    .gte('effective_until', new Date().toISOString())
    .order('shipping_method');

  if (error) {
    console.error('❌ Failed to fetch default shipping settings:', error);
    throw error;
  }

  console.log('✅ Default shipping settings fetched:', data?.length || 0);
  return data || [];
};

// 送料計算実行
const calculateShippingCost = async (request: ShippingCostRequest): Promise<ShippingCostResponse> => {
  console.log('🔄 Calculating shipping cost:', request);

  // 取引先固有の設定を取得
  const supplierSettings = await getSupplierShippingSettings(request.supplier_id);

  let selectedSetting: ShippingCostSetting | null = null;

  if (supplierSettings.length > 0) {
    // 配送方法が指定されている場合、該当する設定を検索
    if (request.shipping_method) {
      selectedSetting = supplierSettings.find(
        setting => setting.shipping_method === request.shipping_method
      ) || null;
    }

    // 見つからない場合、標準配送を選択
    if (!selectedSetting) {
      selectedSetting = supplierSettings.find(
        setting => setting.shipping_method === 'standard'
      ) || supplierSettings[0];
    }
  }

  // 取引先固有の設定がない場合、デフォルト設定を使用
  if (!selectedSetting) {
    console.log('⚠️ No supplier-specific settings, using default');
    const defaultSettings = await getDefaultShippingSettings();

    if (request.shipping_method) {
      selectedSetting = defaultSettings.find(
        setting => setting.shipping_method === request.shipping_method
      ) || null;
    }

    if (!selectedSetting && defaultSettings.length > 0) {
      selectedSetting = defaultSettings.find(
        setting => setting.shipping_method === 'standard'
      ) || defaultSettings[0];
    }
  }

  if (!selectedSetting) {
    throw new Error('適用可能な送料設定が見つかりません');
  }

  return ShippingCostCalculator.calculateShippingCost(selectedSetting, request);
};

// 送料設定取得カスタムフック
export function useShippingSettings(supplierId?: string | number) {
  // 文字列IDを数値IDに変換（partnersテーブルの型に統一）
  const numericSupplierId = useMemo(() => {
    if (!supplierId) return undefined;
    if (typeof supplierId === 'number') return supplierId;
    // 文字列の場合は数値に変換を試み、変換できない場合はundefined
    const parsed = parseInt(supplierId, 10);
    return isNaN(parsed) ? undefined : parsed;
  }, [supplierId]);

  const { data: supplierSettings, isLoading: isLoadingSupplier, error: supplierError } = useQuery({
    queryKey: ['shipping-settings', numericSupplierId],
    queryFn: () => numericSupplierId ? getSupplierShippingSettings(numericSupplierId) : Promise.resolve([]),
    enabled: !!numericSupplierId,
    staleTime: 300000, // 5分間キャッシュ
  });

  const { data: defaultSettings, isLoading: isLoadingDefault, error: defaultError } = useQuery({
    queryKey: ['shipping-settings', 'default'],
    queryFn: getDefaultShippingSettings,
    staleTime: 300000, // 5分間キャッシュ
  });

  return {
    supplierSettings: supplierSettings || [],
    defaultSettings: defaultSettings || [],
    isLoading: isLoadingSupplier || isLoadingDefault,
    error: supplierError || defaultError,
  };
}

// 送料計算カスタムフック
export function useShippingCalculation() {
  const calculateMutation = useMutation({
    mutationFn: calculateShippingCost,
    onSuccess: (data) => {
      console.log('💰 Shipping cost calculation successful:', data);
    },
    onError: (error) => {
      console.error('❌ Shipping cost calculation error:', error);
    },
  });

  return {
    calculateShipping: calculateMutation.mutateAsync,
    isCalculating: calculateMutation.isPending,
    calculationError: calculateMutation.error,
    lastCalculation: calculateMutation.data,
  };
}

// 送料自動入力カスタムフック
export function useAutoShippingInput() {
  const { calculateShipping } = useShippingCalculation();

  // 取引先と注文情報から自動的に送料を計算
  const autoCalculateShipping = async (params: {
    supplierId: string | number;
    orderValue?: number;
    totalWeight?: number;
    shippingMethod?: string;
  }) => {
    try {
      // UUIIDの場合は送料計算をスキップ（デフォルト値を返す）
      if (params.supplierId && isUUID(params.supplierId)) {
        console.log('🚚 UUID supplier detected, using default shipping calculation');
        return {
          shipping_cost: 500, // デフォルト送料
          shipping_tax: 50,
          shipping_cost_with_tax: 550,
          is_free_shipping: false,
          shipping_method: params.shippingMethod || 'standard',
          calculation_details: 'Default shipping rate applied for UUID supplier',
        };
      }

      // 数値IDの場合のみ詳細計算
      const numericSupplierId = typeof params.supplierId === 'number'
        ? params.supplierId
        : params.supplierId
          ? parseInt(params.supplierId, 10)
          : null;

      // NaNチェック
      if (numericSupplierId !== null && isNaN(numericSupplierId)) {
        console.log('🚚 Invalid numeric supplier ID, using default shipping');
        return {
          shipping_cost: 500,
          shipping_tax: 50,
          shipping_cost_with_tax: 550,
          is_free_shipping: false,
          shipping_method: params.shippingMethod || 'standard',
          calculation_details: 'Default shipping rate applied for invalid supplier ID',
        };
      }

      const request: ShippingCostRequest = {
        supplier_id: numericSupplierId,
        order_value: params.orderValue,
        total_weight: params.totalWeight,
        shipping_method: params.shippingMethod || 'standard',
      };

      const result = await calculateShipping(request);

      return {
        shipping_cost: result.total_cost,
        shipping_tax: result.tax_amount,
        shipping_cost_with_tax: result.total_with_tax,
        is_free_shipping: result.is_free_shipping,
        shipping_method: result.shipping_method,
        calculation_details: result.calculation_details,
      };
    } catch (error) {
      console.error('❌ Auto shipping calculation failed:', error);
      // エラーの場合はデフォルト値を返す（エラーを投げない）
      return {
        shipping_cost: 500,
        shipping_tax: 50,
        shipping_cost_with_tax: 550,
        is_free_shipping: false,
        shipping_method: params.shippingMethod || 'standard',
        calculation_details: `Error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  };

  return {
    autoCalculateShipping,
  };
}

// 送料設定管理カスタムフック（管理者用）
export function useShippingSettingsManagement() {
  const queryClient = useQueryClient();

  const createSettingMutation = useMutation({
    mutationFn: async (setting: Omit<ShippingCostSetting, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('shipping_cost_settings')
        .insert(setting)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-settings'] });
    },
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ShippingCostSetting> & { id: string }) => {
      const { data, error } = await supabase
        .from('shipping_cost_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-settings'] });
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_cost_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-settings'] });
    },
  });

  return {
    createSetting: createSettingMutation.mutateAsync,
    updateSetting: updateSettingMutation.mutateAsync,
    deleteSetting: deleteSettingMutation.mutateAsync,
    isCreating: createSettingMutation.isPending,
    isUpdating: updateSettingMutation.isPending,
    isDeleting: deleteSettingMutation.isPending,
  };
}

// 送料関連ユーティリティ
export const ShippingUtils = {
  // 配送方法のラベル
  getShippingMethodLabel: (method: string): string => {
    const labels = {
      standard: '通常配送',
      express: '速達',
      overnight: '翌日配送',
      pickup: '店舗受取',
    };
    return labels[method as keyof typeof labels] || method;
  },

  // 送料の表示フォーマット
  formatShippingCost: (cost: number, isFree: boolean = false): string => {
    if (isFree) return '送料無料';
    return `送料: ¥${cost.toLocaleString()}`;
  },

  // 送料込み合計の表示
  formatTotalWithShipping: (orderTotal: number, shippingCost: number, isFree: boolean = false): string => {
    const shipping = isFree ? 0 : shippingCost;
    const total = orderTotal + shipping;
    return `合計: ¥${total.toLocaleString()}（送料${isFree ? '無料' : `¥${shipping.toLocaleString()}`}込み）`;
  },

  // 送料無料まであといくら
  getAmountToFreeShipping: (currentValue: number, threshold: number): string => {
    const remaining = threshold - currentValue;
    if (remaining <= 0) return '送料無料';
    return `送料無料まであと¥${remaining.toLocaleString()}`;
  },
};