import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';
import { Plus, Edit, Building, Search, X, Users, TrendingUp, ShoppingCart, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { partnerFormSchema, PartnerFormData } from '../lib/validations';
import { FormField, FormInput, FormSelect, FormTextarea } from '../components/FormField';
import { DayPicker } from '../components/DayPicker';
import PageManual from '../components/PageManual';
import { manuals } from '../data/manuals';

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
  closing_day: number | null;
  payment_day: number | null;
  payment_month_offset: number;
}

export default function Partners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'supplier' | 'customer' | 'both'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'created_at_asc' | 'created_at_desc'>('created_at_desc');

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
  } = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      partner_code: '',
      name: '',
      partner_type: 'supplier',
      contact_person: '',
      email: '',
      phone: '',
      fax: '',
      address: '',
      payment_terms: '',
      closing_day: 0,
      payment_day: 0,
      payment_month_offset: 1,
      bank_name: '',
      branch_name: '',
      account_number: '',
      account_holder: '',
    },
  });

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Partners fetch error:', error);
      toast.error('取引先データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: PartnerFormData) => {
    try {
      const partnerData = {
        partner_code: formData.partner_code,
        name: formData.name,
        partner_type: formData.partner_type,
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        fax: formData.fax || null,
        address: formData.address || null,
        payment_terms: formData.payment_terms || null,
        closing_day: formData.closing_day ?? null,
        payment_day: formData.payment_day ?? null,
        payment_month_offset: formData.payment_month_offset ?? 1,
        bank_name: formData.bank_name || null,
        branch_name: formData.branch_name || null,
        account_number: formData.account_number || null,
        account_holder: formData.account_holder || null,
      };

      if (editingPartner) {
        const { error } = await supabase
          .from('partners')
          .update(partnerData)
          .eq('id', editingPartner.id);

        if (error) throw error;
        toast.success('取引先を更新しました');
      } else {
        const { error } = await supabase
          .from('partners')
          .insert([{ ...partnerData, is_active: true }]);

        if (error) throw error;
        toast.success('取引先を作成しました');
      }

      resetForm();
      fetchPartners();
    } catch (error: any) {
      console.error('Partner save error:', error);

      // Supabaseエラーの詳細を取得してユーザーフレンドリーなメッセージを表示
      let errorMessage = '取引先の保存に失敗しました';

      if (error?.code === '23505') {
        // ユニーク制約違反（重複）
        if (error.message?.includes('partner_code')) {
          errorMessage = `取引先コード「${formData.partner_code}」は既に登録されています。別のコードを使用してください。`;
        } else if (error.message?.includes('email')) {
          errorMessage = `メールアドレス「${formData.email}」は既に登録されています。`;
        } else {
          errorMessage = '入力されたデータは既に登録されています。重複のないデータを入力してください。';
        }
      } else if (error?.code === '23503') {
        // 外部キー制約違反
        errorMessage = '関連するデータが見つかりません。データを確認してください。';
      } else if (error?.message) {
        // その他のSupabaseエラー
        errorMessage = `エラー: ${error.message}`;
      }

      toast.error(errorMessage);
    }
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner(partner);
    reset({
      partner_code: partner.partner_code,
      name: partner.name,
      partner_type: partner.partner_type,
      contact_person: partner.contact_person || '',
      email: partner.email || '',
      phone: partner.phone || '',
      fax: (partner as any).fax || '',
      address: partner.address || '',
      payment_terms: '',
      closing_day: partner.closing_day ?? 0,
      payment_day: partner.payment_day ?? 0,
      payment_month_offset: partner.payment_month_offset ?? 1,
      bank_name: (partner as any).bank_name || '',
      branch_name: (partner as any).branch_name || '',
      account_number: (partner as any).account_number || '',
      account_holder: (partner as any).account_holder || '',
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
    reset({
      partner_code: '',
      name: '',
      partner_type: 'supplier',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      payment_terms: '',
      closing_day: 0,
      payment_day: 0,
      payment_month_offset: 1,
      bank_name: '',
      branch_name: '',
      account_number: '',
      account_holder: '',
    });
    setEditingPartner(null);
    setShowForm(false);
  };

  const getPartnerTypeLabel = (type: string) => {
    switch (type) {
      case 'supplier': return '仕入先';
      case 'customer': return '販売先';
      case 'both': return '仕入先・販売先';
      default: return type;
    }
  };

  // フィルタリングとサーチ機能
  const filteredPartners = partners
    .filter((partner) => {
      // タイプフィルター
      if (filterType !== 'all' && partner.partner_type !== filterType) {
        return false;
      }

      // アクティブ状態フィルター
      if (filterActive === 'active' && !partner.is_active) {
        return false;
      }
      if (filterActive === 'inactive' && partner.is_active) {
        return false;
      }

      // 検索クエリ
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
          (partner.name && partner.name.toLowerCase().includes(query)) ||
          (partner.partner_code && partner.partner_code.toLowerCase().includes(query)) ||
          (partner.contact_person && partner.contact_person.toLowerCase().includes(query)) ||
          (partner.phone && partner.phone.toLowerCase().includes(query)) ||
          (partner.email && partner.email.toLowerCase().includes(query))
        );
        return matchesSearch;
      }

      return true;
    })
    .sort((a, b) => {
      // 並び替え
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, 'ja');
        case 'name_desc':
          return b.name.localeCompare(a.name, 'ja');
        case 'created_at_asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'created_at_desc':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  // 統計情報の計算
  const totalPartners = partners.length;
  const supplierCount = partners.filter(p => p.partner_type === 'supplier' || p.partner_type === 'both').length;
  const customerCount = partners.filter(p => p.partner_type === 'customer' || p.partner_type === 'both').length;
  const activePartners = partners.filter(p => p.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">取引先管理</h1>
            <p className="text-blue-100 mt-1 font-inter text-sm">仕入先・販売先の管理と登録</p>
          </div>
          <div className="flex items-center gap-3">
            <PageManual {...manuals.partners} />
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center px-5 py-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-md hover:shadow-xl font-jakarta font-semibold"
            >
              <Plus className="w-5 h-5 mr-2" />
              新規取引先
            </button>
          </div>
        </div>
      </div>

      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">総取引先数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{totalPartners}</p>
              <p className="text-xs text-gray-500 mt-1">登録済み取引先</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">仕入先</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{supplierCount}</p>
              <p className="text-xs text-gray-500 mt-1">仕入先として登録</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">販売先</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{customerCount}</p>
              <p className="text-xs text-gray-500 mt-1">販売先として登録</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <ShoppingCart className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">有効</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{activePartners}</p>
              <p className="text-xs text-gray-500 mt-1">アクティブな取引先</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <CheckCircle className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 検索・フィルターセクション */}
      <div className="bg-white rounded-xl shadow-md p-6">
        {/* フィルターヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-inter font-semibold text-gray-800 text-lg">フィルター</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showFilters ? '閉じる' : '開く'}
          </button>
        </div>

        {/* 検索ボックス */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="取引先名、コード、担当者、電話番号、メールアドレスで検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center hover:text-gray-600"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
            </button>
          )}
        </div>

        {/* 詳細フィルター */}
        {showFilters && (
          <div className="mt-4 space-y-4">
            {/* 第1行: 取引先種別とアクティブ状態 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">取引先種別</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'supplier' | 'customer' | 'both')}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="all">すべて</option>
                  <option value="supplier">仕入先</option>
                  <option value="customer">販売先</option>
                  <option value="both">仕入先・販売先</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">状態</label>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="all">すべて</option>
                  <option value="active">アクティブ</option>
                  <option value="inactive">非アクティブ</option>
                </select>
              </div>
            </div>

            {/* 第2行: 並び替え */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-inter font-semibold text-gray-700 mb-2">並び替え</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white text-gray-900"
                >
                  <option value="created_at_desc">登録日（新しい順）</option>
                  <option value="created_at_asc">登録日（古い順）</option>
                  <option value="name_asc">取引先名（昇順）</option>
                  <option value="name_desc">取引先名（降順）</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* フィルター結果の表示 */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">
            <span className="text-blue-600 font-semibold">{filteredPartners.length}</span>件の取引先が見つかりました
          </div>
          {(filterType !== 'all' || filterActive !== 'all' || sortBy !== 'created_at_desc') && (
            <button
              onClick={() => {
                setFilterType('all');
                setFilterActive('all');
                setSortBy('created_at_desc');
              }}
              className="text-sm px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              <X className="w-4 h-4" />
              フィルターをクリア
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">
            {editingPartner ? '取引先編集' : '新規取引先作成'}
          </h2>
          <form onSubmit={handleFormSubmit(handleSubmit)} className="grid grid-cols-2 gap-4">
            <FormField label="取引先名" required error={errors.name}>
              <FormInput
                type="text"
                error={errors.name}
                placeholder="例: ABC商事株式会社"
                {...register('name')}
              />
            </FormField>

            <FormField label="取引先コード" required error={errors.partner_code}>
              <FormInput
                type="text"
                error={errors.partner_code}
                placeholder="例: SUP-001"
                {...register('partner_code')}
              />
            </FormField>

            <FormField label="取引先種別" required error={errors.partner_type}>
              <FormSelect
                error={errors.partner_type}
                options={[
                  { value: 'supplier', label: '仕入先' },
                  { value: 'customer', label: '販売先' },
                  { value: 'both', label: '仕入先・販売先' },
                ]}
                {...register('partner_type')}
              />
            </FormField>

            <FormField label="担当者名" error={errors.contact_person}>
              <FormInput
                type="text"
                error={errors.contact_person}
                placeholder="例: 田中太郎"
                {...register('contact_person')}
              />
            </FormField>

            <FormField label="電話番号" error={errors.phone}>
              <FormInput
                type="text"
                error={errors.phone}
                placeholder="例: 03-1234-5678"
                {...register('phone')}
              />
            </FormField>

            <FormField label="FAX番号" error={errors.fax}>
              <FormInput
                type="text"
                error={errors.fax}
                placeholder="例: 03-1234-5679"
                {...register('fax')}
              />
            </FormField>

            <FormField label="メールアドレス" error={errors.email}>
              <FormInput
                type="email"
                error={errors.email}
                placeholder="例: tanaka@example.com"
                {...register('email')}
              />
            </FormField>

            <div className="col-span-2">
              <FormField label="住所" error={errors.address}>
                <FormTextarea
                  rows={3}
                  error={errors.address}
                  placeholder="例: 東京都渋谷区..."
                  {...register('address')}
                />
              </FormField>
            </div>

            {/* Closing day settings section */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">締日・支払日設定</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="締日" error={errors.closing_day}>
                  <Controller
                    name="closing_day"
                    control={control}
                    render={({ field }) => (
                      <DayPicker
                        value={field.value ?? null}
                        onChange={field.onChange}
                        error={errors.closing_day}
                      />
                    )}
                  />
                </FormField>

                <FormField label="支払日" error={errors.payment_day}>
                  <Controller
                    name="payment_day"
                    control={control}
                    render={({ field }) => (
                      <DayPicker
                        value={field.value ?? null}
                        onChange={field.onChange}
                        error={errors.payment_day}
                      />
                    )}
                  />
                </FormField>

                <FormField label="支払月" error={errors.payment_month_offset}>
                  <FormSelect
                    error={errors.payment_month_offset}
                    options={[
                      { value: '0', label: '当月' },
                      { value: '1', label: '翌月' },
                      { value: '2', label: '翌々月' },
                      { value: '3', label: '3ヶ月後' },
                    ]}
                    {...register('payment_month_offset', {
                      setValueAs: (v) => Number(v)
                    })}
                  />
                </FormField>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                例: 締日「20日」、支払月「翌月」、支払日「月末」の場合、毎月20日締めで翌月末払いとなります。
              </p>
            </div>

            {/* Bank account information section */}
            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">銀行口座情報（振込先）</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="銀行名" error={errors.bank_name}>
                  <FormInput
                    type="text"
                    error={errors.bank_name}
                    placeholder="例: 三菱UFJ銀行"
                    {...register('bank_name')}
                  />
                </FormField>

                <FormField label="支店名" error={errors.branch_name}>
                  <FormInput
                    type="text"
                    error={errors.branch_name}
                    placeholder="例: 新宿支店"
                    {...register('branch_name')}
                  />
                </FormField>

                <FormField label="口座番号" error={errors.account_number}>
                  <FormInput
                    type="text"
                    error={errors.account_number}
                    placeholder="例: 1234567"
                    {...register('account_number')}
                  />
                </FormField>

                <FormField label="口座名義" error={errors.account_holder}>
                  <FormInput
                    type="text"
                    error={errors.account_holder}
                    placeholder="例: カ）フジセイコウ"
                    {...register('account_holder')}
                  />
                </FormField>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                仕入先への支払時に使用する振込先口座情報を入力してください。
              </p>
            </div>

            <div className="col-span-2 flex justify-end space-x-2 mt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={isSubmitting}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    処理中...
                  </span>
                ) : (
                  editingPartner ? '更新' : '作成'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
          <table className="min-w-full border-collapse">
            <thead className="bg-gradient-to-b from-slate-50 to-slate-100 border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  取引先名
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  コード
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  タイプ
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  担当者
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  電話番号
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  メールアドレス
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                  ステータス
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 whitespace-nowrap">
                  操作
                </th>
              </tr>
            </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredPartners.map((partner, index) => (
              <tr key={partner.id} className={`transition-all duration-150 hover:bg-blue-50 hover:shadow-sm ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                  <div className="text-xs font-medium text-slate-900">{partner.name}</div>
                </td>
                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{partner.partner_code}</div>
                </td>
                <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                  <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-md ${
                    partner.partner_type === 'supplier'
                      ? 'bg-blue-100 text-blue-800'
                      : partner.partner_type === 'customer'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {getPartnerTypeLabel(partner.partner_type)}
                  </span>
                </td>
                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{partner.contact_person || '-'}</div>
                </td>
                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{partner.phone || '-'}</div>
                </td>
                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{partner.email || '-'}</div>
                </td>
                <td className="px-3 py-2 text-center border-r border-slate-200 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-md ${
                    partner.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {partner.is_active ? '有効' : '無効'}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => handleEdit(partner)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="編集"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(partner.id, partner.is_active)}
                      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                        partner.is_active
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {partner.is_active ? '無効化' : '有効化'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
