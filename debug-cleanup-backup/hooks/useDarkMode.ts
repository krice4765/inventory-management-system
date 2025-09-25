import { useDarkModeStore } from '../stores/darkModeStore';

export function useDarkMode() {
  const { isDark, toggle } = useDarkModeStore();
  return { isDark, toggle };
}