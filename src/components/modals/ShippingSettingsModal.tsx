import React, { useState, useEffect } from 'react';
import { X, Truck, Plus, Edit, Trash2, Save, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useDarkMode } from '../../hooks/useDarkMode';
import {
  useShippingSettings,
  useShippingSettingsManagement,
  ShippingCostSetting,
  ShippingUtils
} from '../../hooks/useShippingCost';

interface ShippingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId?: string;
  supplierName?: string;
}

interface ShippingFormData {
  shipping_method: string;
  base_cost: number;
  weight_threshold?: number;
  additional_cost_per_kg?: number;
  free_shipping_threshold?: number;
  tax_rate: number;
  is_active: boolean;
  effective_from: string;
  effective_until?: string;
}

const defaultFormData: ShippingFormData = {
  shipping_method: 'standard',
  base_cost: 800,
  weight_threshold: 10,
  additional_cost_per_kg: 100,
  free_shipping_threshold: 10000,
  tax_rate: 0.1,
  is_active: true,
  effective_from: new Date().toISOString().split('T')[0],
};

export const ShippingSettingsModal: React.FC<ShippingSettingsModalProps> = ({
  isOpen,
  onClose,
  supplierId,
  supplierName
}) => {
  const { isDark } = useDarkMode();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShippingFormData>(defaultFormData);
  const [showForm, setShowForm] = useState(false);

  // 送料設定取得
  const { supplierSettings, defaultSettings, isLoading } = useShippingSettings(supplierId);

  // 送料設定管理
  const {
    createSetting,
    updateSetting,
    deleteSetting,
    isCreating,
    isUpdating,
    isDeleting
  } = useShippingSettingsManagement();

  // 表示する設定一覧（取引先固有設定 または デフォルト設定）
  const displaySettings = supplierId ? supplierSettings : defaultSettings;

  useEffect(() => {
    if (!isOpen) {
      setEditingId(null);
      setShowForm(false);
      setFormData(defaultFormData);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const settingData = {
        ...formData,
        supplier_id: supplierId ? parseInt(supplierId) : null,
        effective_from: new Date(formData.effective_from).toISOString(),
        effective_until: formData.effective_until
          ? new Date(formData.effective_until).toISOString()
          : null,
      };

      if (editingId) {
        await updateSetting({ id: editingId, ...settingData });
        toast.success('送料設定を更新しました');
      } else {
        await createSetting(settingData);
        toast.success('送料設定を作成しました');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(defaultFormData);
    } catch (error) {
      console.error('Setting save error:', error);
      toast.error('保存に失敗しました');
    }
  };

  const handleEdit = (setting: ShippingCostSetting) => {
    setFormData({
      shipping_method: setting.shipping_method,
      base_cost: setting.base_cost,
      weight_threshold: setting.weight_threshold || undefined,
      additional_cost_per_kg: setting.additional_cost_per_kg || undefined,
      free_shipping_threshold: setting.free_shipping_threshold || undefined,
      tax_rate: setting.tax_rate,
      is_active: setting.is_active,
      effective_from: setting.effective_from.split('T')[0],
      effective_until: setting.effective_until?.split('T')[0] || undefined,
    });
    setEditingId(setting.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この送料設定を削除しますか？')) return;

    try {
      await deleteSetting(id);
      toast.success('送料設定を削除しました');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('削除に失敗しました');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`w-full max-w-4xl rounded-lg shadow-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          }`}
        >
          {/* ヘッダー */}
          <div className={`flex items-center justify-between p-6 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <div className="flex items-center space-x-3">
              <Truck className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className={`text-xl font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  送料設定管理
                </h2>
                <p className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {supplierName ? `${supplierName} 固有設定` : 'デフォルト設定'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* コンテンツ */}
          <div className="p-6 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  読み込み中...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 新規作成ボタン */}
                {!showForm && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>新規送料設定</span>
                  </button>
                )}

                {/* フォーム */}
                {showForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleSubmit}
                    className={`p-4 rounded-lg border ${
                      isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          配送方法
                        </label>
                        <select
                          value={formData.shipping_method}
                          onChange={(e) => setFormData({ ...formData, shipping_method: e.target.value })}
                          className={`w-full px-3 py-2 rounded-md border ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          <option value="standard">標準配送</option>
                          <option value="express">速達</option>
                          <option value="overnight">翌日配送</option>
                          <option value="pickup">店舗受取</option>
                        </select>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-1 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          基本送料 (円)
                        </label>
                        <input
                          type="number"
                          value={formData.base_cost}
                          onChange={(e) => setFormData({ ...formData, base_cost: parseInt(e.target.value) })}
                          className={`w-full px-3 py-2 rounded-md border ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300'
                          }`}
                          min="0"
                          required
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-1 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          重量閾値 (kg)
                        </label>
                        <input
                          type="number"
                          value={formData.weight_threshold || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            weight_threshold: e.target.value ? parseInt(e.target.value) : undefined
                          })}
                          className={`w-full px-3 py-2 rounded-md border ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300'
                          }`}
                          min="0"
                          placeholder="オプション"
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-1 ${
                          isDark ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          送料無料条件 (円)
                        </label>
                        <input
                          type="number"
                          value={formData.free_shipping_threshold || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            free_shipping_threshold: e.target.value ? parseInt(e.target.value) : undefined
                          })}
                          className={`w-full px-3 py-2 rounded-md border ${
                            isDark
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300'
                          }`}
                          min="0"
                          placeholder="オプション"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditingId(null);
                          setFormData(defaultFormData);
                        }}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          isDark
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        disabled={isCreating || isUpdating}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        <span>{editingId ? '更新' : '作成'}</span>
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* 設定一覧 */}
                {displaySettings.length === 0 ? (
                  <div className={`text-center py-8 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>送料設定がありません</p>
                    <p className="text-sm">新規作成してください</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displaySettings.map((setting) => (
                      <div
                        key={setting.id}
                        className={`p-4 rounded-lg border ${
                          isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`font-medium ${
                                isDark ? 'text-white' : 'text-gray-900'
                              }`}>
                                {ShippingUtils.getShippingMethodLabel(setting.shipping_method)}
                              </span>
                              {!setting.is_active && (
                                <span className="px-2 py-1 text-xs bg-gray-500 text-white rounded">
                                  無効
                                </span>
                              )}
                            </div>
                            <div className={`text-sm space-y-1 ${
                              isDark ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              <p>基本送料: ¥{setting.base_cost.toLocaleString()}</p>
                              {setting.free_shipping_threshold && (
                                <p>送料無料: ¥{setting.free_shipping_threshold.toLocaleString()}以上</p>
                              )}
                              {setting.weight_threshold && (
                                <p>重量制限: {setting.weight_threshold}kg</p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(setting)}
                              className={`p-2 rounded transition-colors ${
                                isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                              }`}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(setting.id)}
                              disabled={isDeleting}
                              className={`p-2 rounded transition-colors text-red-600 ${
                                isDark ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                              }`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};