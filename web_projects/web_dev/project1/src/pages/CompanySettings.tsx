import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { Building2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { FormField, FormInput, FormTextarea } from '../components/FormField';

interface CompanySettings {
  id: string;
  company_name: string;
  company_name_kana: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  registration_number: string | null;
  logo_url: string | null;
}

const companySettingsSchema = z.object({
  company_name: z.string().min(1, '会社名は必須です').max(200, '200文字以内で入力してください'),
  company_name_kana: z.string().max(200, '200文字以内で入力してください').optional().or(z.literal('')),
  postal_code: z.string().max(20, '20文字以内で入力してください').optional().or(z.literal('')),
  address: z.string().max(500, '500文字以内で入力してください').optional().or(z.literal('')),
  phone: z.string().max(50, '50文字以内で入力してください').optional().or(z.literal('')),
  fax: z.string().max(50, '50文字以内で入力してください').optional().or(z.literal('')),
  email: z.string().email('有効なメールアドレスを入力してください').max(100, '100文字以内で入力してください').optional().or(z.literal('')),
  website: z.string().url('有効なURLを入力してください').max(200, '200文字以内で入力してください').optional().or(z.literal('')),
  registration_number: z.string().max(50, '50文字以内で入力してください').optional().or(z.literal('')),
});

type CompanySettingsFormData = z.infer<typeof companySettingsSchema>;

export default function CompanySettings() {
  const [loading, setLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CompanySettingsFormData>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      company_name: '',
      company_name_kana: '',
      postal_code: '',
      address: '',
      phone: '',
      fax: '',
      email: '',
      website: '',
      registration_number: '',
    },
  });

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettingsId(data.id);
        reset({
          company_name: data.company_name,
          company_name_kana: data.company_name_kana || '',
          postal_code: data.postal_code || '',
          address: data.address || '',
          phone: data.phone || '',
          fax: data.fax || '',
          email: data.email || '',
          website: data.website || '',
          registration_number: data.registration_number || '',
        });
      }
    } catch (error) {
      console.error('Company settings fetch error:', error);
      toast.error('会社設定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: CompanySettingsFormData) => {
    try {
      const settingsData = {
        company_name: formData.company_name,
        company_name_kana: formData.company_name_kana || null,
        postal_code: formData.postal_code || null,
        address: formData.address || null,
        phone: formData.phone || null,
        fax: formData.fax || null,
        email: formData.email || null,
        website: formData.website || null,
        registration_number: formData.registration_number || null,
      };

      if (settingsId) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsData)
          .eq('id', settingsId);

        if (error) throw error;
        toast.success('会社設定を更新しました');
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert(settingsData)
          .select()
          .single();

        if (error) throw error;
        setSettingsId(data.id);
        toast.success('会社設定を登録しました');
      }

      await fetchCompanySettings();
    } catch (error: any) {
      console.error('Company settings save error:', error);
      const errorMessage = error?.message || '会社設定の保存に失敗しました';
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">会社設定</h1>
          <p className="text-sm text-gray-600 mt-1">会社情報の登録・編集</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleFormSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="会社名" required error={errors.company_name}>
              <FormInput
                type="text"
                error={errors.company_name}
                placeholder="例: 株式会社サンプル"
                {...register('company_name')}
              />
            </FormField>

            <FormField label="会社名（カナ）" error={errors.company_name_kana}>
              <FormInput
                type="text"
                error={errors.company_name_kana}
                placeholder="例: カブシキガイシャサンプル"
                {...register('company_name_kana')}
              />
            </FormField>

            <FormField label="郵便番号" error={errors.postal_code}>
              <FormInput
                type="text"
                error={errors.postal_code}
                placeholder="例: 123-4567"
                {...register('postal_code')}
              />
            </FormField>

            <FormField label="登録番号" error={errors.registration_number}>
              <FormInput
                type="text"
                error={errors.registration_number}
                placeholder="例: T1000000000000"
                {...register('registration_number')}
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
                placeholder="例: info@example.com"
                {...register('email')}
              />
            </FormField>

            <FormField label="ウェブサイト" error={errors.website}>
              <FormInput
                type="url"
                error={errors.website}
                placeholder="例: https://example.com"
                {...register('website')}
              />
            </FormField>
          </div>

          <FormField label="住所" error={errors.address}>
            <FormTextarea
              error={errors.address}
              placeholder="例: 東京都渋谷区恵比寿1-23-4 恵比寿タワー2階"
              rows={3}
              {...register('address')}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
