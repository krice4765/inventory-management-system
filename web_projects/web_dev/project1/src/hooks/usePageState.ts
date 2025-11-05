import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface PageState {
  scrollPosition?: number;
  filters?: Record<string, any>;
  [key: string]: any;
}

/**
 * ページの状態（フィルター、スクロール位置など）を保存・復元するカスタムフック
 *
 * @example
 * const { savePageState, restorePageState } = usePageState();
 *
 * // ページ遷移時に状態を保存
 * <Link to="/detail" state={savePageState({ filters: { status: 'active' } })}>
 *
 * // ページ読み込み時に状態を復元
 * useEffect(() => {
 *   const restored = restorePageState();
 *   if (restored) {
 *     setFilters(restored.filters);
 *     // スクロール位置は自動的に復元されます
 *   }
 * }, []);
 */
export function usePageState() {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRestored = useRef(false);

  /**
   * 現在のページ状態を保存
   */
  const savePageState = (additionalState?: Record<string, any>): PageState => {
    return {
      scrollPosition: window.scrollY,
      ...additionalState,
      fromPath: location.pathname,
    };
  };

  /**
   * 保存されたページ状態を復元
   */
  const restorePageState = (): PageState | null => {
    const state = location.state as PageState;

    if (!state) {
      return null;
    }

    // スクロール位置を復元（一度だけ）
    if (state.scrollPosition !== undefined && !scrollRestored.current) {
      // DOM更新を待ってからスクロール（複数フレーム待機）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            window.scrollTo(0, state.scrollPosition!);
            scrollRestored.current = true;
          }, 100);
        });
      });
    }

    return state;
  };

  /**
   * 状態をクリア（必要に応じて）
   */
  const clearPageState = () => {
    navigate(location.pathname, { replace: true, state: null });
  };

  return {
    savePageState,
    restorePageState,
    clearPageState,
  };
}
