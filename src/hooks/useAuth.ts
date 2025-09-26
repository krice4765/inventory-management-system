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
      }
    } else {
      // プロファイルが存在しない場合は新規作成

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
      }

      const newProfile = {
        id: user.id,
        email: user.email || '',
        full_name: (() => {
          // 申請データから名前を抽出
          if (applicationData?.requested_reason) {
            const match = applicationData.requested_reason.match(/【申請者名】(.+?)(?:\n|$)/);
            if (match) return match[1].trim();
          }
          return applicationData?.email?.split('@')[0] || user.email?.split('@')[0] || 'ユーザー';
        })(),
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

      // 競合を避けるため、まずINSERTを試行し、エラーの場合はUPDATEに切り替え
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert([newProfile]);

      if (insertError) {
        // 重複キー制約エラー（23505）や競合エラーの場合は既存のプロファイルが作成されたということなので警告レベル
        if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('conflict')) {
          console.warn('⚠️ User profile already exists (created by another process):', user.email);
          // 既存プロファイルの last_login_at を更新（静かに失敗する）
          try {
            await supabase
              .from('user_profiles')
              .update({ last_login_at: new Date().toISOString() })
              .eq('id', user.id);
          } catch (updateError) {
            // 更新エラーは無視（別のプロセスが同時に更新している可能性）
            console.debug('Last login update skipped due to concurrent access');
          }
        } else {
          console.error('❌ User profile creation failed:', insertError.message);
          console.error('Error details:', insertError);
        }
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
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
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
