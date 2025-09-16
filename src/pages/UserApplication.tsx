import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Building,
  Users,
  Briefcase,
  FileText,
  Send,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

interface ApplicationForm {
  email: string;
  company_name: string;
  department: string;
  position: string;
  requested_reason: string;
}

export default function UserApplication() {
  const [formData, setFormData] = useState<ApplicationForm>({
    email: '',
    company_name: '',
    department: '',
    position: '',
    requested_reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<ApplicationForm>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<ApplicationForm> = {};

    if (!formData.email) {
      newErrors.email = 'メールアドレスは必須です';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }

    if (!formData.company_name) {
      newErrors.company_name = '会社名は必須です';
    }

    if (!formData.department) {
      newErrors.department = '部署名は必須です';
    }

    if (!formData.position) {
      newErrors.position = '役職は必須です';
    }

    if (!formData.requested_reason) {
      newErrors.requested_reason = '利用目的は必須です';
    } else if (formData.requested_reason.length < 10) {
      newErrors.requested_reason = '利用目的は10文字以上で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('入力内容を確認してください');
      return;
    }

    setIsSubmitting(true);

    try {
      // 既存申請の確認（RLS回避のため）
      let existingApplication = null;
      let checkError = null;
      try {
        const { data, error } = await supabase
          .from('user_applications')
          .select('id, application_status')
          .eq('email', formData.email)
          .maybeSingle(); // single()ではなくmaybeSingle()を使用

        checkError = error;
        if (checkError && checkError.code !== 'PGRST116') {
          console.log('既存申請チェックエラー:', checkError);
        } else {
          existingApplication = data;
        }
      } catch (error) {
        console.log('既存申請チェック例外:', error);
      }

      // テーブルが存在しない場合はスキップ
      if (checkError && (checkError.code === 'PGRST116' || checkError.message.includes('does not exist'))) {
        console.warn('user_applications テーブルが存在しません。新規申請として処理します。');
      } else if (checkError && checkError.code !== 'PGRST116') {
        // その他のエラーは続行
        console.log('既存申請チェック:', checkError.message);
      }

      if (existingApplication) {
        if (existingApplication.application_status === 'pending') {
          toast.error('既に申請済みです。審査結果をお待ちください。');
          return;
        } else if (existingApplication.application_status === 'approved') {
          toast.error('既に承認済みのアカウントです。');
          return;
        }
      }

      // 新規申請の送信（明示的にステータスを設定）
      const applicationData = {
        ...formData,
        application_status: 'pending',
        created_at: new Date().toISOString()
      };

      console.log('📝 申請データ送信:', applicationData);

      const { error } = await supabase
        .from('user_applications')
        .insert([applicationData]);

      if (error) {
        console.error('📝 申請送信エラー詳細:', error);

        // RLSポリシーエラーの場合
        if (error.code === '42501' || error.message.includes('row-level security')) {
          toast.error('申請機能の準備中です。システム管理者にお問い合わせください。');
          return;
        }

        // テーブルが存在しない場合の処理
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          toast.error('ユーザー管理システムがまだ準備中です。しばらくお待ちください。');
          return;
        }

        // HTTP 406エラーの場合
        if (error.code === 'PGRST116' || error.message.includes('406')) {
          toast.error('申請形式に問題があります。入力内容を確認してください。');
          return;
        }

        throw error;
      }

      // 管理者への通知作成
      await createAdminNotification(formData.email);

      setIsSubmitted(true);
      toast.success('申請を送信しました！管理者による審査をお待ちください。');

    } catch (error: any) {
      console.error('申請送信エラー:', error);
      if (error.code === '23505') { // Unique constraint violation
        toast.error('既に申請済みのメールアドレスです');
      } else {
        toast.error('申請の送信に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const createAdminNotification = async (email: string) => {
    try {
      // 管理者ユーザーIDを取得
      const adminEmails = ['dev@inventory.test', 'Krice4765104@gmail.com', 'prod@inventory.test'];

      const { data: adminUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .in('email', adminEmails);

      if (adminUsers && adminUsers.length > 0) {
        const notifications = adminUsers.map(admin => ({
          user_id: admin.id,
          type: 'user_application',
          title: '新規ユーザー申請',
          message: `${email} からシステム利用申請が届きました`,
          metadata: { email, application_type: 'new_user' }
        }));

        await supabase
          .from('system_notifications')
          .insert(notifications);
      }
    } catch (error) {
      console.error('通知作成エラー:', error);
      // 通知作成の失敗は申請自体には影響させない
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // エラーをクリア
    if (errors[name as keyof ApplicationForm]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-8 h-8 text-green-600" />
          </motion.div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">申請完了</h2>
          <p className="text-gray-600 mb-6">
            システム利用申請を受け付けました。<br />
            管理者による審査完了後、招待メールをお送りします。
          </p>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">次のステップ</h3>
            <ol className="text-sm text-blue-800 space-y-1 text-left">
              <li>1. 管理者による申請内容の審査</li>
              <li>2. 承認時に招待メールを送信</li>
              <li>3. 招待リンクからパスワード設定</li>
              <li>4. システム利用開始</li>
            </ol>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ログインページに戻る
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">システム利用申請</h1>
          <p className="text-blue-100 mt-2">
            総合業務管理システムの利用申請フォームです
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* メールアドレス */}
          <div>
            <label htmlFor="email" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 mr-2 text-blue-600" />
              メールアドレス <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="your.email@company.com"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* 会社名 */}
          <div>
            <label htmlFor="company_name" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Building className="w-4 h-4 mr-2 text-blue-600" />
              会社名 <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.company_name ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="株式会社○○"
            />
            {errors.company_name && (
              <p className="text-red-500 text-sm mt-1">{errors.company_name}</p>
            )}
          </div>

          {/* 部署名 */}
          <div>
            <label htmlFor="department" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4 mr-2 text-blue-600" />
              部署名 <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="department"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.department ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="営業部"
            />
            {errors.department && (
              <p className="text-red-500 text-sm mt-1">{errors.department}</p>
            )}
          </div>

          {/* 役職 */}
          <div>
            <label htmlFor="position" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Briefcase className="w-4 h-4 mr-2 text-blue-600" />
              役職 <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              id="position"
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.position ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="主任"
            />
            {errors.position && (
              <p className="text-red-500 text-sm mt-1">{errors.position}</p>
            )}
          </div>

          {/* 利用目的 */}
          <div>
            <label htmlFor="requested_reason" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 mr-2 text-blue-600" />
              利用目的 <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              id="requested_reason"
              name="requested_reason"
              rows={4}
              value={formData.requested_reason}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${
                errors.requested_reason ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="システムを利用する目的や業務内容について詳しく記載してください（10文字以上）"
            />
            {errors.requested_reason && (
              <p className="text-red-500 text-sm mt-1">{errors.requested_reason}</p>
            )}
            <p className="text-gray-500 text-sm mt-1">
              {formData.requested_reason.length}/500文字
            </p>
          </div>

          {/* 注意事項 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">申請前の注意事項</h3>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• 申請内容は管理者によって審査されます</li>
              <li>• 承認された場合、招待メールが送信されます</li>
              <li>• 招待メールからパスワードを設定してシステムを利用開始できます</li>
              <li>• 審査には数営業日かかる場合があります</li>
            </ul>
          </div>

          {/* 送信ボタン */}
          <div className="flex space-x-4">
            <Link
              to="/login"
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              キャンセル
            </Link>
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  申請を送信
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}