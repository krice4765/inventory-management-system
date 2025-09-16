import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// ユーザープロファイル自動作成とログイン時間更新のヘルパー関数
const ensureUserProfile = async (user: User) => {
  try {
    // 1. まず既存のプロファイルを確認
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      // 406エラー（Not Acceptable）やRLSエラーの場合でもプロファイル作成を試行
      console.warn('⚠️ Profile fetch failed, attempting to create new profile:', fetchError.message);
      // fetchErrorがあっても処理を続行（プロファイル作成を試行）
    }

    if (existingProfile && !fetchError) {
      // 既存プロファイルがある場合は last_login_at のみ更新
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) {
        console.warn('Last login time update failed:', updateError.message);
      } else {
        console.log('Last login time updated successfully for existing user');
      }
    } else {
      // プロファイルが存在しない場合は新規作成
      console.log('Creating new user profile for:', user.email);

      // 承認済み申請から情報を取得
      let applicationData = null;
      const { data: application } = await supabase
        .from('user_applications')
        .select('*')
        .eq('email', user.email)
        .eq('application_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (application) {
        applicationData = application;
        console.log('Found approved application data for user profile creation');
      }

      const newProfile = {
        id: user.id,
        email: user.email || '',
        full_name: applicationData?.email?.split('@')[0] || user.email?.split('@')[0] || 'ユーザー',
        company_name: applicationData?.company_name || null,
        department: applicationData?.department || null,
        position: applicationData?.position || null,
        role: 'user' as const,
        is_active: true,
        last_login_at: new Date().toISOString(),
        invited_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert([newProfile]);

      if (insertError) {
        // 重複キー制約エラーの場合は既存のプロファイルが作成されたということなので警告レベル
        if (insertError.code === '23505') {
          console.warn('⚠️ User profile already exists (created by another process):', user.email);
          // 既存プロファイルの last_login_at を更新
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id);

          if (!updateError) {
            console.log('✅ Last login time updated for existing profile');
          }
        } else {
          console.error('❌ User profile creation failed:', insertError.message);
          console.error('Error details:', insertError);
        }
      } else {
        console.log('✅ User profile created successfully for:', user.email);
      }
    }
  } catch (error) {
    console.error('Profile management error:', error);
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. アプリケーション起動時に現在のセッション情報を取得
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);

        // 既存セッションがある場合、プロファイルの確認と更新
        if (session?.user) {
          console.log('Existing session found, ensuring user profile');
          ensureUserProfile(session.user);
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 2. 認証状態の変更を監視するリスナーを設定
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          toast.success('ログインしました！');
          // プロファイルの確認と更新
          ensureUserProfile(session.user);
        }
        if (event === 'SIGNED_OUT') {
          // ログアウト時のリダイレクトは呼び出し側で行うため、トーストはApp.tsxで統一管理
          // toast.success('ログアウトしました。'); // App.tsxで処理
        }
      }
    );

    // 3. クリーンアップ関数でリスナーを解除
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 各認証関数をuseCallbackでメモ化
  const signIn = useCallback(async (email: string, password: string) => {
    console.log('🔐 ログイン試行:', { email, hasPassword: !!password });
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      console.log('🔐 ログイン結果:', {
        success: !result.error,
        error: result.error?.message,
        user: result.data.user?.email
      });
      return result;
    } catch (error) {
      console.error('🚨 ログイン例外:', error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    return supabase.auth.signUp({ email, password });
  }, []);
  
  const resetPassword = useCallback(async (email: string) => {
    return supabase.auth.resetPasswordForEmail(email);
  }, []);


  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
};
