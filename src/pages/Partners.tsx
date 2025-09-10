import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Building, Search, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useDarkMode } from '../hooks/useDarkMode';

interface Partner {
  id: string;
  name: string;
  partner_code: string;
  partner_type: 'supplier' | 'customer' | 'both';
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  is_active: boolean;
  created_at: string;
}

export default function Partners() {
  const queryClient = useQueryClient();
  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<'all' | 'supplier' | 'customer' | 'both'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [formData, setFormData] = useState({
    name: '',
    partner_code: '',
    partner_type: 'supplier' as 'supplier' | 'customer' | 'both',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  // 検索・フィルタリング機能
  useEffect(() => {
    if (!partners.length) return;

    let filtered = partners.filter(partner => {
      const matchesSearch = !searchTerm || (
        partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.partner_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        partner.phone.toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesType = partnerTypeFilter === 'all' || partner.partner_type === partnerTypeFilter;

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && partner.is_active) ||
        (statusFilter === 'inactive' && !partner.is_active);

      return matchesSearch && matchesType && matchesStatus;
    });

    setFilteredPartners(filtered);
  }, [partners, searchTerm, partnerTypeFilter, statusFilter]);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
      setFilteredPartners(data || []);
    } catch (error) {
      console.error('Partners fetch error:', error);
      toast.error('取引先データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPartner) {
        const { error } = await supabase
          .from('partners')
          .update(formData)
          .eq('id', editingPartner.id);

        if (error) throw error;
        
        // 担当者情報が更新された場合、発注担当者テーブルも同期
        if (formData.contact_person && formData.contact_person.trim()) {
          await syncPartnerToOrderManager(editingPartner.id, formData);
        }
        
        toast.success('取引先を更新しました');
        console.log('✅ パートナー更新完了 - 担当者同期:', formData.contact_person);
      } else {
        const { data: newPartner, error } = await supabase
          .from('partners')
          .insert([{ ...formData, is_active: true }])
          .select()
          .single();

        if (error) throw error;
        
        // 担当者情報がある場合、発注担当者テーブルにも追加
        if (formData.contact_person && formData.contact_person.trim()) {
          await syncPartnerToOrderManager(newPartner.id, formData);
        }
        
        toast.success('取引先を作成しました');
        console.log('✅ パートナー作成完了 - 担当者同期:', formData.contact_person);
      }

      resetForm();
      
      // React Queryキャッシュの即座無効化
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      queryClient.invalidateQueries({ queryKey: ['order-managers'] });
      
      // 従来のfetchPartners()も保持
      fetchPartners();
    } catch (error) {
      console.error('Partner save error:', error);
      toast.error('取引先の保存に失敗しました');
    }
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      partner_code: partner.partner_code,
      partner_type: partner.partner_type,
      contact_person: partner.contact_person,
      phone: partner.phone,
      email: partner.email,
      address: partner.address,
    });
    setShowForm(true);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('partners')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(currentStatus ? '取引先を無効化しました' : '取引先を有効化しました');
      fetchPartners();
    } catch (error) {
      console.error('Partner toggle error:', error);
      toast.error('取引先の状態変更に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      partner_code: '',
      partner_type: 'supplier',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
    });
    setEditingPartner(null);
    setShowForm(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setPartnerTypeFilter('all');
    setStatusFilter('all');
  };

  // パートナー担当者を発注担当者テーブルに同期する関数
  const syncPartnerToOrderManager = async (partnerId: string, partnerData: any) => {
    try {
      // 既存の発注担当者をチェック（名前のみで重複チェック）
      const { data: existingManager } = await supabase
        .from('order_managers')
        .select('id')
        .eq('name', partnerData.contact_person)
        .maybeSingle();

      if (!existingManager) {
        // 新規発注担当者として追加
        const { error } = await supabase
          .from('order_managers')
          .insert([{
            name: partnerData.contact_person,
            department: `${partnerData.name}担当`,
            email: partnerData.email || null,
            is_active: true,
            partner_id: partnerId // パートナーとの関連を保持
          }]);

        if (error) {
          console.warn('発注担当者の同期に失敗:', error);
        } else {
          console.log('発注担当者を同期しました:', partnerData.contact_person);
          // 発注担当者キャッシュを無効化して最新データを反映
          queryClient.invalidateQueries({ queryKey: ['order-managers'] });
        }
      } else {
        console.log('発注担当者は既に存在します:', partnerData.contact_person);
      }
    } catch (error) {
      console.warn('発注担当者同期エラー:', error);
      // エラーが発生してもメイン処理は継続
    }
  };

  const getPartnerTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return '仕入先';
      case 'customer': return '販売先';
      case 'both': return '仕入先・販売先';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">取引先データを読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">取引先管理</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              新規取引先
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all shadow-sm hover:shadow-md"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* 検索・フィルター機能 */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* 検索バー */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="取引先名・コード・担当者・連絡先で検索..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 取引先種別フィルター */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">種別:</label>
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={partnerTypeFilter}
                onChange={(e) => setPartnerTypeFilter(e.target.value as 'all' | 'supplier' | 'customer' | 'both')}
              >
                <option value="all">すべて</option>
                <option value="supplier">仕入先</option>
                <option value="customer">販売先</option>
                <option value="both">仕入先・販売先</option>
              </select>
            </div>

            {/* ステータスフィルター */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">状態:</label>
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">すべて</option>
                <option value="active">有効</option>
                <option value="inactive">無効</option>
              </select>
            </div>

            {/* クリアボタン */}
            {(searchTerm || partnerTypeFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <X className="w-4 h-4 mr-1" />
                クリア
              </button>
            )}
          </div>
        </div>

        {/* 検索結果数表示 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {searchTerm || partnerTypeFilter !== 'all' || statusFilter !== 'all' ? (
            <span>
              {filteredPartners.length}件の結果 (全{partners.length}件中)
            </span>
          ) : (
            <span>全{partners.length}件の取引先</span>
          )}
        </div>

        {showForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {editingPartner ? '取引先編集' : '新規取引先作成'}
            </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">取引先名</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">取引先コード</label>
              <input
                type="text"
                required
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.partner_code}
                onChange={(e) => setFormData({ ...formData, partner_code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">取引先種別</label>
              <select
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.partner_type}
                onChange={(e) => setFormData({ ...formData, partner_type: e.target.value as 'supplier' | 'customer' | 'both' })}
              >
                <option value="supplier">仕入先</option>
                <option value="customer">販売先</option>
                <option value="both">仕入先・販売先</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">担当者名</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">電話番号</label>
              <input
                type="text"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">メールアドレス</label>
              <input
                type="email"
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">住所</label>
              <textarea
                className="mt-1 block w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="col-span-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingPartner ? '更新' : '作成'}
              </button>
            </div>
          </form>
          </div>
        )}

        {/* 取引先一覧テーブル */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  取引先情報
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  連絡先
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ステータス
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredPartners.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">該当する取引先が見つかりません</p>
                    <p className="text-sm">
                      {searchTerm || partnerTypeFilter !== 'all' || statusFilter !== 'all'
                        ? '検索条件を変更してお試しください'
                        : '取引先がまだありません'
                      }
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredPartners.map((partner) => (
              <tr key={partner.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Building className="h-8 w-8 text-gray-400" />
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{partner.name}</div>
                      <div className="text-sm text-gray-500">{partner.partner_code}</div>
                      <div className="text-sm text-gray-500">{getPartnerTypeLabel(partner.partner_type)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{partner.contact_person}</div>
                  <div className="text-sm text-gray-500">{partner.phone}</div>
                  <div className="text-sm text-gray-500">{partner.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    partner.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {partner.is_active ? '有効' : '無効'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(partner)}
                    className="text-indigo-600 hover:text-indigo-900 mr-2"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(partner.id, partner.is_active)}
                    className={`${partner.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                  >
                    {partner.is_active ? '無効化' : '有効化'}
                  </button>
                </td>
              </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
