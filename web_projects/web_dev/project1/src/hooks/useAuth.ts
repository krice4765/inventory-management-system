import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

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

        if (event === 'SIGNED_IN') {
          toast.success('ログインしました！');
        }
        if (event === 'SIGNED_OUT') {
          // ログアウト時のリダイレクトは呼び出し側で行うため、ここではtoastのみ
          toast.success('ログアウトしました。');
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
    return supabase.auth.signInWithPassword({ email, password });
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
