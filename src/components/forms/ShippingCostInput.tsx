import React, { useState, useEffect, useMemo } from 'react';
import { Truck, Calculator, AlertCircle, Check, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useShippingSettings, useAutoShippingInput, ShippingUtils } from '../../hooks/useShippingCost';

interface ShippingCostInputProps {
      supplierId?: string; orderValue?: number; totalWeight?: number; value?: number; onChange: (shippingCost: number, shippingTax: number, details?: any) => void;
      disabled?: boolean; error?: string; className?: string; showCalculationButton?: boolean; autoCalculate?: boolean; }

export const ShippingCostInput: React.FC<ShippingCostInputProps> = ({
  supplierId,
  orderValue = 0,
  totalWeight,
  value = 0,
  onChange,
  disabled = false,
  error,
  className = '',
  showCalculationButton = true,
  autoCalculate = true,
}) => {
  const { isDark } = useDarkMode();
  const { supplierSettings, defaultSettings, isLoading: isLoadingSettings } = useShippingSettings(supplierId);
  const { autoCalculateShipping } = useAutoShippingInput();

  const [selectedMethod, setSelectedMethod] = useState<string>('standard');
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculation, setLastCalculation] = useState<any>(null);
  const [manualInput, setManualInput] = useState(false);

  // 利用可能な配送方法
  const availableMethods = useMemo(() => {
      const settings = supplierSettings.length > 0 ? supplierSettings : defaultSettings; return settings.map(setting => ({
      value: setting.shipping_method,
      label: ShippingUtils.getShippingMethodLabel(setting.shipping_method),
      baseCost: setting.base_cost,
      freeThreshold: setting.free_shipping_threshold,
    }));
  }, [supplierSettings, defaultSettings]);

  // 自動計算実行
      const performCalculation = async (method?: string) => { if (!supplierId) return;

    setIsCalculating(true);
    try {
      const result = await autoCalculateShipping({
        supplierId,
        orderValue,
        totalWeight,
        shippingMethod: method || selectedMethod,
      });

      setLastCalculation(result);
      onChange(result.shipping_cost, result.shipping_tax, result);

    } catch (error) {
      console.error('❌ Shipping calculation failed:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // 自動計算の実行（依存関係変更時）
  useEffect(() => {
    if (autoCalculate && supplierId && !manualInput && availableMethods.length > 0) {
      performCalculation();
    }
  }, [supplierId, orderValue, totalWeight, selectedMethod, autoCalculate, availableMethods.length]);

  // 手動入力値の更新
      const handleManualInput = (inputValue: string) => { const numericValue = parseInt(inputValue) || 0;
    setManualInput(true);
    onChange(numericValue, Math.floor(numericValue * 0.1), { manual: true }); // 10%税率で計算
  };

  // 配送方法変更
      const handleMethodChange = (method: string) => { setSelectedMethod(method);
    if (!manualInput) {
      performCalculation(method);
    }
  };

  // 自動計算モードに戻る
  const resetToAutoCalculation = () => {
    setManualInput(false);
    if (supplierId) {
      performCalculation();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 配送方法選択 */}
      {availableMethods.length > 1 && (
        <div>
          <label className={`block text-sm font-medium mb-2 ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
            配送方法
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availableMethods.map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => handleMethodChange(method.value)}
                disabled={disabled}
                className={`
                  px-3 py-2 text-sm border rounded-lg transition-colors
                  ${selectedMethod === method.value
      ? 'border-blue-500 bg-blue-50 text-blue-700 dark: bg-blue-900 dark:text-blue-200' : isDark ? 'border-gray-600 bg-gray-700 text-gray-300 hover: border-gray-500' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400' }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="font-medium">{method.label}</div>
                <div className="text-xs opacity-75">
                  {method.freeThreshold
                    ? `¥${method.freeThreshold.toLocaleString()}以上で無料`
                    : `¥${method.baseCost.toLocaleString()}`
                  }
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 送料入力フィールド */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`text-sm font-medium ${
      isDark ? 'text-gray-300' : 'text-gray-700' }`}>
            送料
          </label>
          <div className="flex items-center space-x-2">
            {/* 自動計算ボタン */}
            {showCalculationButton && supplierId && (
              <button
                type="button"
                onClick={() => performCalculation()}
                disabled={disabled || isCalculating}
                className={`
                  flex items-center space-x-1 px-2 py-1 text-xs border rounded transition-colors
                  ${isDark
      ? 'border-gray-600 text-gray-400 hover: text-white hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400' }
                  ${disabled || isCalculating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                title="自動計算"
              >
                {isCalculating ? (
                  <Loader className="h-3 w-3 animate-spin" />
      ) : ( <Calculator className="h-3 w-3" />
                )}
                <span>自動計算</span>
              </button>
            )}

            {/* 手動入力切り替え */}
            {manualInput && (
              <button
                type="button"
                onClick={resetToAutoCalculation}
                className={`
      flex items-center space-x-1 px-2 py-1 text-xs text-blue-600 hover: text-blue-800 border border-blue-300 rounded transition-colors
                `}
                title="自動計算に戻る"
              >
                <Check className="h-3 w-3" />
                <span>自動</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Truck className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
      error ? 'text-red-500' : 'text-gray-400' }`} />

          <input
            type="number"
            value={value}
            onChange={(e) => handleManualInput(e.target.value)}
            disabled={disabled}
            placeholder="送料を入力..."
            className={`
              w-full pl-10 pr-4 py-2 border rounded-lg transition-colors
              ${disabled
                ? 'bg-gray-100 cursor-not-allowed'
      : isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500' }
              ${error
                ? 'border-red-500 ring-1 ring-red-500'
      : 'focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500' }
            `}
          />

          {/* 計算中インジケーター */}
          {isCalculating && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader className="h-4 w-4 animate-spin text-blue-500" />
            </div>
          )}
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div className="flex items-center space-x-1 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 計算結果の詳細表示 */}
      <AnimatePresence>
        {lastCalculation && !manualInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`
              p-3 rounded-lg border
              ${isDark
                ? 'bg-gray-800 border-gray-700'
      : 'bg-gray-50 border-gray-200' }
            `}
          >
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                  配送方法:
                </span>
                <span className={isDark ? 'text-white' : 'text-gray-900'}>
                  {ShippingUtils.getShippingMethodLabel(lastCalculation.shipping_method)}
                </span>
              </div>

              {lastCalculation.is_free_shipping ? (
                <div className="text-green-600 font-medium text-center">
                  🎉 送料無料適用
                </div>
      ) : ( <>
                  <div className="flex justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      送料（税抜）:
                    </span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      ¥{lastCalculation.shipping_cost.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      消費税:
                    </span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      ¥{lastCalculation.shipping_tax.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between font-medium border-t pt-1">
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      送料計（税込）:
                    </span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>
                      ¥{lastCalculation.shipping_cost_with_tax.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* 送料無料まであといくら */}
            {!lastCalculation.is_free_shipping &&
             availableMethods.find(m => m.value === selectedMethod)?.freeThreshold && (
              <div className={`mt-2 text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                💡 {ShippingUtils.getAmountToFreeShipping(
                  orderValue,
                  availableMethods.find(m => m.value === selectedMethod)?.freeThreshold || 0
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 読み込み状態 */}
      {isLoadingSettings && (
        <div className={`flex items-center space-x-2 text-sm ${
      isDark ? 'text-gray-400' : 'text-gray-500' }`}>
          <Loader className="h-4 w-4 animate-spin" />
          <span>送料設定を読み込み中...</span>
        </div>
      )}
    </div>
  );
};