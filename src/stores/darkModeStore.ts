import { create } from 'zustand';

interface DarkModeStore {
  isDark: boolean;
  toggle: () => void;
}

// 初期状態を取得
const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const saved = localStorage.getItem('darkMode');
  if (saved !== null) {
    return JSON.parse(saved);
  }
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// DOMクラスを更新
const updateDOMClass = (isDark: boolean) => {
  if (typeof document !== 'undefined') {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

// 初期化実行
const initialDarkMode = getInitialDarkMode();
updateDOMClass(initialDarkMode);

export const useDarkModeStore = create<DarkModeStore>((set, get) => ({
  isDark: initialDarkMode,
  
  toggle: () => {
    set((state) => {
      const newIsDark = !state.isDark;
      
      // localStorageに保存
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('darkMode', JSON.stringify(newIsDark));
      }
      
      // DOMクラスを更新
      updateDOMClass(newIsDark);
      
      return { isDark: newIsDark };
    });
  },
}));