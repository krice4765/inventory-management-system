import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Building, Search, X, Users, Sparkles, Handshake } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useDarkMode } from '../hooks/useDarkMode';
import { motion } from 'framer-motion';
import { ModernCard } from '../components/ui/ModernCard';

interface Partner {
  id: string;
  name: string;
  partner_code: string;
  partner_type: 'supplier' | 'customer' | 'both';
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
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

    try {
      let filtered = partners.filter(partner => {
      const matchesSearch = !searchTerm || (
        (partner.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (partner.partner_code?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (partner.contact_person?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (partner.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (partner.phone?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );

      const matchesType = partnerTypeFilter === 'all' || partner.partner_type === partnerTypeFilter;

      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && partner.is_active) ||
        (statusFilter === 'inactive' && !partner.is_active);

      return matchesSearch && matchesType && matchesStatus;
      });

      setFilteredPartners(filtered);
    } catch (error) {
      console.error('Filter error in Partners:', error);
      setFilteredPartners(partners); // エラー時は全パートナーを表示
    }
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
      // 既存の発注担当者をチェック（メールアドレスがある場合は優先、無い場合は名前）
      let existingManager;
      
      if (partnerData.email && partnerData.email.trim()) {
        // メールアドレスがある場合、メールアドレスで重複チェック
        const { data } = await supabase
          .from('order_managers')
          .select('id, name, email')
          .eq('email', partnerData.email.trim())
          .maybeSingle();
        existingManager = data;
      } else {
        // メールアドレスがない場合、名前で重複チェック
        const { data } = await supabase
          .from('order_managers')
          .select('id, name, email')
          .eq('name', partnerData.contact_person)
          .maybeSingle();
        existingManager = data;
      }

      if (!existingManager) {
        // 新規発注担当者として追加
        const insertData: any = {
          name: partnerData.contact_person,
          department: `${partnerData.name}担当`,
          is_active: true,
          partner_id: partnerId // パートナーとの関連を保持
        };

        // メールアドレスがある場合のみ追加（重複制約を避けるため）
        if (partnerData.email && partnerData.email.trim()) {
          insertData.email = partnerData.email.trim();
        }

        const { error } = await supabase
          .from('order_managers')
          .insert([insertData]);

        if (error) {
          console.warn('発注担当者の同期に失敗:', error);
          throw error;
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500">
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent"
          />
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ml-4 text-lg font-medium text-gray-700 dark:text-gray-300"
          >
            取引先データを読み込み中...
          </motion.span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-all duration-500 font-inter">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="p-6 space-y-8"
      >
        {/* ヘッダー */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 15 }}
              className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg"
            >
              <Handshake className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-noto-sans-jp">
                取引先管理
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">パートナー企業との関係を管理</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(true)}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Plus className="w-5 h-5 mr-2" />
              新規取引先
              <Sparkles className="w-4 h-4 ml-2 opacity-75" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleDarkMode}
              className="p-3 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {isDark ? '☀️' : '🌙'}
            </motion.button>
          </div>
        </motion.div>

        {/* 検索・フィルター機能 */}
        <ModernCard className="p-6" glass>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col lg:flex-row gap-4 items-center"
          >
            {/* 検索バー */}
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="取引先名・コード・担当者・連絡先で検索..."
                className="w-full pl-11 pr-4 py-3 border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* 取引先種別フィルター */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">種別:</label>
              <select
                className="px-4 py-3 border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
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
                className="px-4 py-3 border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
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
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-3 border-0 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 shadow-sm"
              >
                <X className="w-4 h-4 mr-1" />
                クリア
              </motion.button>
            )}
          </motion.div>
        </ModernCard>

        {/* 検索結果数表示 */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm text-gray-600 dark:text-gray-400 px-2"
        >
          {searchTerm || partnerTypeFilter !== 'all' || statusFilter !== 'all' ? (
            <span>
              {filteredPartners.length}件の結果 (全{partners.length}件中)
            </span>
          ) : (
            <span>全{partners.length}件の取引先</span>
          )}
        </motion.div>

        {showForm && (
          <ModernCard className="p-6" glass>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-noto-sans-jp">
                {editingPartner ? '取引先編集' : '新規取引先作成'}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">取引先名</label>
                  <input
                    type="text"
                    required
                    className="block w-full border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">取引先コード</label>
                  <input
                    type="text"
                    required
                    className="block w-full border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
                    value={formData.partner_code}
                    onChange={(e) => setFormData({ ...formData, partner_code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">取引先種別</label>
                  <select
                    className="block w-full border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
                    value={formData.partner_type}
                    onChange={(e) => setFormData({ ...formData, partner_type: e.target.value as 'supplier' | 'customer' | 'both' })}
                  >
                    <option value="supplier">仕入先</option>
                    <option value="customer">販売先</option>
                    <option value="both">仕入先・販売先</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">担当者名</label>
                  <input
                    type="text"
                    className="block w-full border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">電話番号</label>
                  <input
                    type="text"
                    className="block w-full border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">メールアドレス</label>
                  <input
                    type="email"
                    className="block w-full border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">住所</label>
                  <textarea
                    className="block w-full border-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-gray-800 transition-all duration-300 shadow-sm resize-none"
                    rows={3}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex justify-end space-x-4 pt-4">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={resetForm}
                    className="px-6 py-3 border-0 text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 shadow-sm font-medium"
                  >
                    キャンセル
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-all duration-300 font-medium"
                  >
                    {editingPartner ? '更新' : '作成'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </ModernCard>
        )}

        {/* 取引先一覧テーブル */}
        <ModernCard className="overflow-hidden" glass>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <table className="min-w-full divide-y divide-gray-200/20 dark:divide-gray-700/20">
              <thead className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    取引先情報
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    連絡先
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm divide-y divide-gray-200/20 dark:divide-gray-700/20">
                {filteredPartners.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center">
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-gray-500 dark:text-gray-400"
                      >
                        <Users className="w-16 h-16 mx-auto mb-6 opacity-50" />
                        <p className="text-xl font-semibold mb-3">該当する取引先が見つかりません</p>
                        <p className="text-sm">
                          {searchTerm || partnerTypeFilter !== 'all' || statusFilter !== 'all'
                            ? '検索条件を変更してお試しください'
                            : '取引先がまだありません'
                          }
                        </p>
                      </motion.div>
                    </td>
                  </tr>
                ) : (
                  filteredPartners.map((partner, index) => (
                    <motion.tr 
                      key={partner.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="hover:bg-white/50 dark:hover:bg-gray-800/50 transition-all duration-200"
                    >
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center">
                              <Building className="h-6 w-6 text-white" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-base font-bold text-gray-900 dark:text-white">{partner.name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">{partner.partner_code}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">{getPartnerTypeLabel(partner.partner_type)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{partner.contact_person}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{partner.phone}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{partner.email}</div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-full ${
                          partner.is_active 
                            ? 'bg-gradient-to-r from-green-400 to-green-500 text-white shadow-lg' 
                            : 'bg-gradient-to-r from-red-400 to-red-500 text-white shadow-lg'
                        }`}>
                          {partner.is_active ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-3">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleEdit(partner)}
                            className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleToggleActive(partner.id, partner.is_active)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-200 ${
                              partner.is_active 
                                ? 'text-red-600 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40' 
                                : 'text-green-600 bg-green-50 hover:bg-green-100 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40'
                            }`}
                          >
                            {partner.is_active ? '無効化' : '有効化'}
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </motion.div>
        </ModernCard>
      </motion.div>
    </div>
  );
}
